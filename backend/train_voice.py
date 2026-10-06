"""Retrain the CREMA-D voice model so it survives real microphone audio.

The shipped checkpoint was trained on clean, loud studio reads only. Measured on
held-out clips it scored 69% on clean audio but collapsed to 13% as soon as
background hiss was added, funnelling almost every input into one label. The
cause is a train/inference domain gap, not the network itself.

This script closes that gap: it extracts features from the real dataset and
retrains on aggressively augmented copies (noise, hum, room reverb, clipping,
band-limiting, gain, codec-style low-pass) so the model learns invariances
instead of memorising studio acoustics. Features are cached so training and
evaluation never re-decode audio.
"""
from __future__ import annotations

import argparse
import json
import sys
import warnings
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

warnings.filterwarnings("ignore")

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))

import joblib
import librosa
import numpy as np
import torch
import torch.nn as nn
from scipy import signal
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

from app.services.voice_service import SAMPLE_RATE, compute_features, load_audio_signal

DATA = Path(r"C:\Users\vedan\Downloads\NeuroAI-Voice Recording Dataset\AudioWAV")
ART = BACKEND / "models" / "voice" / "cremad"
CACHE = BACKEND / ".cache" / "voice_features.npz"

LABELS = {"ANG": "Angry", "DIS": "Disgust", "FEA": "Fear", "HAP": "Happy", "NEU": "Neutral", "SAD": "Sad"}


# ─────────────────────────── augmentation ───────────────────────────
def augment(y: np.ndarray, sr: int, rng: np.random.Generator) -> np.ndarray:
    """Simulate a consumer microphone applied to a studio read.

    Every step is optional and randomly skipped so the model still sees clean
    material and the augmentation set covers realistic, not only extreme, cases.
    """
    y = y.astype(np.float32).copy()

    # Gain: microphones deliver wildly different levels before normalisation.
    if rng.random() < 0.7:
        y = y * float(10 ** rng.uniform(-1.5, 0.5))

    # Band-limit: cheap microphones and codecs roll off everything above ~3-8 kHz.
    # A one-pole low-pass approximates that far more cheaply than resampling
    # down and back up, which dominates cache-build time otherwise.
    if rng.random() < 0.45:
        cutoff = float(rng.uniform(3000, 9000))
        rc = 1.0 / (2 * np.pi * cutoff)
        dt = 1.0 / sr
        alpha = dt / (rc + dt)
        y = np.asarray(signal.lfilter([alpha], [1.0, alpha - 1.0], y), dtype=np.float32)

    # Additive hiss: the dominant real-world failure mode.
    if rng.random() < 0.65:
        snr = rng.uniform(2, 25)
        noise = rng.standard_normal(y.size).astype(np.float32)
        signal_rms = float(np.sqrt(np.mean(np.square(y, dtype=np.float64)))) + 1e-9
        noise_rms = signal_rms / (10 ** (snr / 20))
        y = y + noise * noise_rms

    # Mains hum plus a harmonic.
    if rng.random() < 0.25:
        t = np.arange(y.size, dtype=np.float32) / sr
        amp = float(np.sqrt(np.mean(np.square(y, dtype=np.float64)))) * rng.uniform(0.01, 0.15)
        y = y + amp * (np.sin(2 * np.pi * 50 * t)
                       + rng.uniform(0.2, 0.6) * np.sin(2 * np.pi * 100 * t)).astype(np.float32)

    # Room reverb via a few delayed taps.
    if rng.random() < 0.3:
        for delay, gain in ((0.03, 0.35), (0.055, 0.22), (0.09, 0.12)):
            k = int(delay * sr)
            if k < y.size:
                y[k:] += gain * y[:-k]

    # Clipping and quantisation, as from a cheap ADC.
    if rng.random() < 0.25:
        y = np.clip(y * rng.uniform(1.5, 5.0), -1.0, 1.0)
    if rng.random() < 0.2:
        y = np.round(y * 128) / 128

    return np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)


# ─────────────────────────── feature cache ───────────────────────────
def label_of(path: Path) -> str | None:
    codes = [c for c in path.stem.split("_") if c in LABELS]
    return LABELS.get(codes[-1]) if codes else None


def _views_for(path_str: str, label: str, n_views: int, seed: int):
    path = Path(path_str)
    y, sr = load_audio_signal(path)
    rng = np.random.default_rng(abs(hash(path_str)) % (2 ** 32) + seed)
    out = []
    # View 0 is always the clean signal so the model keeps its clean-audio skill.
    out.append(compute_features(y, sr))
    for _ in range(n_views - 1):
        out.append(compute_features(augment(y, sr, rng), sr))
    return np.stack(out).astype(np.float32), label


def build_cache(n_views: int, workers: int, seed: int = 0):
    files = [p for p in sorted(DATA.glob("*.wav")) if label_of(p)]
    print(f"[cache] {len(files)} files x {n_views} views, {workers} workers", flush=True)
    X, y = [], []
    with ProcessPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(_views_for, str(p), label_of(p), n_views, seed): p for p in files}
        done = 0
        for fut, p in futs.items():
            try:
                feats, lab = fut.result()
            except Exception as exc:  # a single bad clip must not kill the run
                print(f"[cache] skip {p.name}: {exc}", flush=True)
                continue
            X.append(feats)
            y.extend([lab] * feats.shape[0])
            done += 1
            if done % 500 == 0:
                print(f"[cache] {done}/{len(files)}", flush=True)
    X = np.concatenate(X, axis=0)
    y = np.array(y)
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(CACHE, X=X, y=y)
    print(f"[cache] saved {X.shape} to {CACHE}", flush=True)


def load_cache():
    d = np.load(CACHE, allow_pickle=True)
    return d["X"], d["y"]


# ────────────────────────────── model ──────────────────────────────
class VoiceNet(nn.Module):
    """Same topology the shipped Keras checkpoint used, so the runtime is unchanged."""

    def __init__(self, in_dim: int, n_classes: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 768), nn.BatchNorm1d(768), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(768, 384), nn.BatchNorm1d(384), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(384, 192), nn.BatchNorm1d(192), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(192, 96), nn.ReLU(),
            nn.Linear(96, n_classes),
        )

    def forward(self, x):
        return self.net(x)

    def predict(self, features, verbose=0):
        """Match the KerasSequentialNet.predict contract used by voice_service."""
        self.eval()
        with torch.no_grad():
            x = torch.from_numpy(np.ascontiguousarray(features, dtype=np.float32)).float()
            if x.ndim == 1:
                x = x.unsqueeze(0)
            return torch.softmax(self(x), dim=-1).cpu().numpy()


def evaluate(model, X, y, encoder, tag, n_views):
    """Report accuracy and the predicted-label distribution on a feature matrix."""
    model.eval()
    with torch.no_grad():
        probs = model(torch.from_numpy(X).float()).numpy()
    pred = probs.argmax(1)
    print(f"\n[{tag}] view-level acc {accuracy_score(y, pred):.1%}", flush=True)
    print(classification_report(y, pred, zero_division=0, digits=3), flush=True)
    cm = confusion_matrix(y, pred, labels=range(len(encoder.classes_)))
    print("confusion matrix (rows=true, cols=pred):", flush=True)
    print(cm, flush=True)
    return probs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--views", type=int, default=6, help="augmented copies per clip")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--workers", type=int, default=10)
    ap.add_argument("--rebuild-cache", action="store_true")
    ap.add_argument("--max-files", type=int, default=0)
    args = ap.parse_args()

    if args.rebuild_cache or not CACHE.exists():
        build_cache(args.views, args.workers)

    X, y = load_cache()
    print(f"[data] {X.shape}, classes={sorted(set(y))}", flush=True)

    encoder = LabelEncoder().fit(y)
    yi = encoder.transform(y)
    Xtr, Xte, ytr, yte = train_test_split(
        X, yi, test_size=0.2, random_state=42, stratify=yi
    )
    scaler = StandardScaler().fit(Xtr)
    Xtr = scaler.transform(Xtr).astype(np.float32)
    Xte = scaler.transform(Xte).astype(np.float32)

    torch.manual_seed(0)
    model = VoiceNet(X.shape[1], len(encoder.classes_))
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=3e-3, epochs=args.epochs, steps_per_epoch=len(Xtr), pct_start=0.25
    )
    lossf = nn.CrossEntropyLoss(label_smoothing=0.05)

    Xtr_t = torch.from_numpy(Xtr)
    ytr_t = torch.from_numpy(ytr).long()
    best, best_state = 0.0, None
    for ep in range(args.epochs):
        model.train()
        perm = torch.randperm(len(Xtr_t))
        total = 0.0
        for i in range(0, len(perm), 256):
            idx = perm[i:i + 256]
            opt.zero_grad()
            out = model(Xtr_t[idx])
            l = lossf(out, ytr_t[idx])
            l.backward()
            opt.step()
            total += float(l) * len(idx)
        sched.step()
        model.eval()
        with torch.no_grad():
            pv = model(torch.from_numpy(Xte)).argmax(1).numpy()
        acc = accuracy_score(yte, pv)
        if acc > best:
            best, best_state = acc, {k: v.clone() for k, v in model.state_dict().items()}
        if ep % 5 == 0 or ep == args.epochs - 1:
            print(f"[ep {ep:3d}] loss {total/len(perm):.4f} val {acc:.1%} (best {best:.1%})", flush=True)

    model.load_state_dict(best_state)
    print(f"\n[best] held-out view accuracy {best:.1%}", flush=True)

    yte_labels = encoder.inverse_transform(yte)
    pv = model(torch.from_numpy(Xte)).argmax(1).numpy()
    print(classification_report(yte_labels, encoder.inverse_transform(pv), zero_division=0, digits=3), flush=True)

    ART.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "in_dim": X.shape[1],
                "n_classes": len(encoder.classes_), "classes": list(encoder.classes_),
                "validation_accuracy": float(best)}, ART / "voice_model.pt")
    joblib.dump(scaler, ART / "scaler.pkl")
    joblib.dump(encoder, ART / "label_encoder.pkl")
    print(f"\n[saved] {ART}", flush=True)


if __name__ == "__main__":
    main()
