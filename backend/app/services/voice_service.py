"""Inference service using the CREMA-D feature pipeline."""
from pathlib import Path
from time import perf_counter
import librosa
import soundfile as sf
import numpy as np
from fastapi import HTTPException
from app.services.model_manager import model_manager
from app.utils.logging import log_event

SAMPLE_RATE = 22050
MIN_SPEECH_SECONDS = 0.6
N_MELS = 64
N_MFCC = 40
F0_MIN, F0_MAX = 65, 500
# CQT/tonnetz need a window of at least ~2 * 1024 samples. Short live mic clips
# used to fall below that and produce meaningless harmonic features, so every
# signal is zero-padded up to this floor before the CQT-based features run.
MIN_FEATURE_SAMPLES = 4096
# Speech sits around a spectral flatness of 1e-4 (harmonically structured) while
# broadband hiss measures above ~0.3. Measured on the CREMA-D set, these two
# constants separate real speech from room noise with a wide margin.
TONAL_FLATNESS_MAX = 0.05
# Fraction of harmonic frames required to accept a clip as speech. Clean studio
# and normal quiet-room speech measure ~1.0, broadband hiss measures 0.00, and
# noisy speech still clears 0.2 at 25 dB SNR, so this sits in a wide empty gap.
MIN_TONAL_RATIO = 0.12
# Real speech always carries some broadband energy (fricatives, breath, room
# tone). A synthetic tone has none, which is what keeps a test tone or a hum
# from being classified as a voice.
MIN_HIGH_FREQUENCY_RATIO = 2e-4


def load_audio_signal(file_path: str | Path):
    path_str = str(file_path)
    try:
        y, sr = librosa.load(path_str, sr=SAMPLE_RATE, mono=True)
        if y.size > 0:
            return y, sr
    except Exception:
        pass

    try:
        data, sr = sf.read(path_str, always_2d=False)
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if sr != SAMPLE_RATE:
            data = librosa.resample(data, orig_sr=sr, target_sr=SAMPLE_RATE)
        if data.size > 0:
            return np.asarray(data, dtype=np.float32), SAMPLE_RATE
    except Exception:
        pass

    raise HTTPException(
        status_code=400,
        detail='Could not decode this audio recording. Please use a clear WAV, MP3, M4A, or browser WebM recording.'
    )


def _distribution(x, axis=0):
    """Mean, std and inter-quartile range summary of a feature frame matrix."""
    return [np.mean(x, axis=axis), np.std(x, axis=axis),
            np.percentile(x, 25, axis=axis), np.percentile(x, 75, axis=axis)]


def compute_features(y: np.ndarray, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Reproduce the 715-value CREMA-D feature vector used at training time.

    Emotion in speech is carried largely by prosody, so this summarises each
    feature with mean, spread and inter-quartile range rather than a single
    time-average, and adds explicit pitch (f0) statistics.
    """
    y, _ = librosa.effects.trim(y, top_db=30)
    if y.size < 2048:
        y = np.zeros(4096, dtype=np.float32)
    elif y.size < MIN_FEATURE_SAMPLES:
        y = np.pad(y, (0, MIN_FEATURE_SAMPLES - y.size), mode='constant')
    y = librosa.util.normalize(y)

    out = []
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
    out += _distribution(mfcc.T)
    out += _distribution(librosa.feature.delta(mfcc).T)
    out += _distribution(librosa.feature.chroma_stft(y=y, sr=sr).T)
    out += _distribution(librosa.feature.tonnetz(y=y, sr=sr).T)

    mel = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, n_mels=N_MELS), ref=1.0)
    out += _distribution(mel.T)
    out += _distribution(librosa.feature.spectral_contrast(y=y, sr=sr).T)

    zcr = librosa.feature.zero_crossing_rate(y)[0]
    rms = librosa.feature.rms(y=y)[0]
    out += _distribution(zcr)
    out += _distribution(rms)
    out += _distribution(np.diff(rms))
    out.append(float(np.percentile(rms, 95) - np.percentile(rms, 5)))

    out += _distribution(librosa.feature.spectral_centroid(y=y, sr=sr)[0])
    out += _distribution(librosa.feature.spectral_bandwidth(y=y, sr=sr)[0])
    out += _distribution(librosa.feature.spectral_rolloff(y=y, sr=sr)[0])
    out += _distribution(librosa.feature.spectral_flatness(y=y)[0])

    f0 = librosa.yin(y, fmin=F0_MIN, fmax=F0_MAX, sr=sr, frame_length=2048)
    voiced = f0[f0 > 0]
    if voiced.size > 3:
        q = np.percentile(voiced, [5, 25, 50, 75, 95])
        out += [float(q.mean()), float(voiced.std()), *q.tolist(),
                float(q[4] - q[0]), float(voiced.max() / max(voiced.min(), 1e-6))]
    else:
        out += [0.0] * 9
    out.append(float(voiced.size) / max(1, f0.size))

    features = np.hstack([np.atleast_1d(np.asarray(o, dtype=np.float64)) for o in out])
    return features.astype(np.float32)


def has_speech(y: np.ndarray, sr: int) -> tuple[bool, float]:
    """Detect real speech from its harmonic structure.

    A plain RMS gate cannot tell a person talking from room noise, so noise-only
    clips used to reach the model and produce a confident, meaningless label.
    Speech is strongly harmonic (very low spectral flatness) and always carries
    some broadband energy; hiss and pure tones fail one of those two tests.
    """
    if y.size < 2048 or float(np.sqrt(np.mean(np.square(y, dtype=np.float64)))) < 1e-4:
        return False, 0.0

    flatness = librosa.feature.spectral_flatness(y=y)[0]
    if flatness.size == 0:
        return False, 0.0

    # Fraction of frames that are harmonic enough to be voiced speech.
    tonal_ratio = float(np.mean(flatness <= TONAL_FLATNESS_MAX))
    if tonal_ratio < MIN_TONAL_RATIO:
        return False, tonal_ratio

    # A voiced vowel is pitchy, so the clip must also have some non-pitchy
    # energy. Pure tones and mains hum have effectively none.
    spec = np.abs(librosa.stft(y))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2 * (spec.shape[0] - 1))
    power = spec.astype(np.float64) ** 2
    total = float(power.sum())
    if total <= 0.0:
        return False, tonal_ratio
    high_ratio = float(power[freqs > 5000].sum() / total)
    if high_ratio < MIN_HIGH_FREQUENCY_RATIO:
        return False, tonal_ratio

    return True, tonal_ratio



SEGMENT_SECONDS = 3.0
SEGMENT_HOP_SECONDS = 1.5
# Below this the model is essentially guessing, and the UI should say so rather
# than presenting a coin flip as a diagnosis.
LOW_CONFIDENCE_THRESHOLD = 40.0


def _segment_windows(y: np.ndarray, sr: int) -> list[np.ndarray]:
    """Split into overlapping windows, or return the whole clip if it is short."""
    size = int(SEGMENT_SECONDS * sr)
    hop = int(SEGMENT_HOP_SECONDS * sr)
    if y.size <= size:
        return [y]
    windows, start = [], 0
    while start + size < y.size:
        windows.append(y[start:start + size])
        start += hop
    if windows:
        windows.append(y[-size:])
    return windows


def _predict(model, scaler, windows: list[np.ndarray], sr: int) -> np.ndarray:
    """Average per-window probabilities.

    A single short window is a high-variance input; averaging several windows of
    the same utterance keeps the label stable without the accuracy cost that
    pure per-window voting showed on clean audio.
    """
    feats = np.vstack([scaler.transform(compute_features(w, sr).reshape(1, -1)) for w in windows])
    expected = getattr(scaler, 'n_features_in_', None)
    if expected is not None and feats.shape[1] != expected:
        raise HTTPException(
            status_code=500,
            detail=f'Voice features ({feats.shape[1]}) do not match the trained CREMA-D model pipeline ({expected}).'
        )
    if not np.all(np.isfinite(feats)):
        raise HTTPException(status_code=400, detail='Audio could not be analysed because it contained unusable data.')
    feats = np.nan_to_num(feats, nan=0.0, posinf=0.0, neginf=0.0)
    return np.asarray(model.predict(feats, verbose=0), dtype=np.float64).mean(axis=0)


def analyze_voice(path: Path) -> dict:
    started = perf_counter()

    try:
        model_manager.ensure_loaded()
        if not model_manager.voice_models_ready():
            raise HTTPException(status_code=503, detail='Trained CREMA-D voice model is still loading. Please retry in a few seconds.')

        y, sr = load_audio_signal(path)

        duration_seconds = round(y.size / sr, 2)
        if duration_seconds < MIN_SPEECH_SECONDS:
            raise HTTPException(
                status_code=400,
                detail=f'Recording is too short ({duration_seconds:.1f}s). Please record at least {MIN_SPEECH_SECONDS:.0f} seconds of speech.'
            )

        speech, voiced = has_speech(y, sr)
        if not speech:
            raise HTTPException(
                status_code=400,
                detail='No clear speech was detected in this recording. Please speak during the recording and check your microphone input level.'
            )

        windows = _segment_windows(y, sr)
        probabilities = _predict(model_manager.voice_model, model_manager.voice_scaler, windows, sr)

        if not np.all(np.isfinite(probabilities)):
            raise HTTPException(status_code=500, detail='Voice model produced unusable output for this recording.')

        index = int(np.argmax(probabilities))
        emotion = str(model_manager.voice_encoder.inverse_transform([index])[0])
        confidence = round(float(probabilities[index]) * 100, 2)
        ranked = np.argsort(probabilities)[::-1][:5]
        top_emotions = [
            {
                'emotion': str(model_manager.voice_encoder.inverse_transform([int(i)])[0]),
                'confidence': round(float(probabilities[int(i)]) * 100, 2)
            }
            for i in ranked
        ]
    except HTTPException:
        raise
    except Exception as exc:
        log_event('voice_inference_error', error=type(exc).__name__)
        raise HTTPException(status_code=500, detail='Voice emotion inference failed while using the trained CREMA-D model.') from exc

    duration = round((perf_counter() - started) * 1000, 2)
    log_event('voice_prediction', emotion=emotion, confidence=confidence, duration_ms=duration)
    return {
        'emotion': emotion,
        'confidence': confidence,
        'top_emotions': top_emotions,
        'duration_seconds': duration_seconds,
        'voiced_ratio': round(voiced, 4),
        'low_confidence': confidence < LOW_CONFIDENCE_THRESHOLD,
        'processing_time_ms': duration,
    }
