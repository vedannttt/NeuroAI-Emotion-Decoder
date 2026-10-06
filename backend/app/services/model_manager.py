"""Read-only singleton loader for the supplied pretrained model artifacts."""
import json, logging, zipfile, tempfile, h5py, os, threading
from pathlib import Path
import joblib, numpy as np, torch
from app.core.config import settings

logger = logging.getLogger(__name__)

class KerasSequentialNet(torch.nn.Module):
    """PyTorch runtime for a Keras 3 ``Sequential`` MLP of Dense/BatchNorm/Dropout.

    The layer graph is read from the checkpoint's own ``config.json`` instead of
    being hard-coded, so a retrained model with different widths or an input size
    loads without editing this file.

    Two Keras details must be reproduced exactly: a Dense layer's activation is
    applied *before* the following BatchNormalization, and Keras uses epsilon
    1e-3 where PyTorch defaults to 1e-5. Dropout is inert at inference time.
    """

    def __init__(self, plan):
        super().__init__()
        self.plan = plan
        self.relu = torch.nn.ReLU()
        self.softmax = torch.nn.Softmax(dim=-1)
        # Register every Linear/BatchNorm as a real submodule so .eval() and
        # state_dict behave normally; BatchNorm needs this to use its stored
        # running statistics instead of the current batch.
        for i, (kind, arg) in enumerate(plan):
            if kind == 'dense':
                self.add_module(f'dense_{i}', arg[0])
            else:
                self.add_module(f'bn_{i}', arg)

    def forward(self, x):
        for kind, arg in self.plan:
            if kind == 'dense':
                x = arg[0](x)
                if arg[1] != 'linear':
                    x = self.softmax(x) if arg[1] == 'softmax' else self.relu(x)
            elif kind == 'bn':
                x = arg(x)
        return x

    def predict(self, features, verbose=0):
        self.eval()
        with torch.no_grad():
            inp = torch.from_numpy(np.ascontiguousarray(features, dtype=np.float32)).float()
            if inp.ndim == 1:
                inp = inp.unsqueeze(0)
            return self(inp).cpu().numpy()


def _read_keras_plan(keras_path: Path):
    """Build the execution plan and weight-variable names from config.json."""
    with zipfile.ZipFile(keras_path) as z:
        cfg = json.loads(z.read('config.json'))
    plan, names = [], []
    last_width = None
    for layer in cfg['config']['layers']:
        cls, lc = layer['class_name'], layer['config']
        if cls == 'InputLayer':
            batch_shape = lc.get('batch_shape') or [None, None]
            last_width = batch_shape[-1]
            continue
        if cls == 'Dense':
            act = lc.get('activation') or 'linear'
            plan.append(('dense', (torch.nn.Linear(last_width, lc['units']), act, lc.get('use_bias', True))))
            names.append(lc['name'])
            last_width = lc['units']
        elif cls == 'BatchNormalization':
            # BatchNormalization stores no width; it inherits the previous width.
            plan.append(('bn', torch.nn.BatchNorm1d(last_width, eps=lc.get('epsilon', 1e-3))))
            names.append(lc['name'])
        elif cls == 'Dropout':
            continue
        else:
            raise ValueError(f'unsupported Keras layer for the PyTorch runtime: {cls}')
    return plan, names


class VoiceNet(torch.nn.Module):
    """MLP used for the augmentation-robust CREMA-D voice classifier.

    Mirrors the topology of the original Keras checkpoint so the ``predict``
    contract consumed by voice_service stays identical.
    """

    def __init__(self, in_dim: int, n_classes: int):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Linear(in_dim, 768), torch.nn.BatchNorm1d(768), torch.nn.ReLU(), torch.nn.Dropout(0.3),
            torch.nn.Linear(768, 384), torch.nn.BatchNorm1d(384), torch.nn.ReLU(), torch.nn.Dropout(0.3),
            torch.nn.Linear(384, 192), torch.nn.BatchNorm1d(192), torch.nn.ReLU(), torch.nn.Dropout(0.2),
            torch.nn.Linear(192, 96), torch.nn.ReLU(),
            torch.nn.Linear(96, n_classes),
        )

    def forward(self, x):
        return self.net(x)

    def predict(self, features, verbose=0):
        """Return softmax probabilities, matching KerasSequentialNet.predict."""
        self.eval()
        with torch.no_grad():
            inp = torch.from_numpy(np.ascontiguousarray(features, dtype=np.float32)).float()
            if inp.ndim == 1:
                inp = inp.unsqueeze(0)
            return torch.softmax(self(inp), dim=-1).cpu().numpy()


def load_voice_model(voice_root: Path):
    """Prefer the retrained torch checkpoint, fall back to the legacy Keras file."""
    pt = voice_root / 'voice_model.pt'
    if pt.exists():
        try:
            ckpt = torch.load(pt, map_location='cpu', weights_only=False)
            model = VoiceNet(ckpt['in_dim'], ckpt['n_classes'])
            model.load_state_dict(ckpt['state_dict'])
            model.eval()
            logger.info(f"Loaded augmentation-robust voice model "
                        f"(held-out accuracy {ckpt.get('validation_accuracy', float('nan')):.1%})")
            return model
        except Exception as e:
            logger.warning(f'PyTorch voice checkpoint failed to load ({e}); trying Keras fallback')

    model = load_voice_model_from_keras(voice_root)
    if model is not None:
        logger.warning('Using the legacy Keras voice checkpoint; it is not microphone-robust')
    return model


def load_voice_model_from_keras(voice_path: Path):
    keras_path = voice_path / 'best_voice_model.keras'
    if not keras_path.exists():
        return None
    temp = None
    try:
        plan, names = _read_keras_plan(keras_path)
        with zipfile.ZipFile(keras_path) as z:
            weights = z.read('model.weights.h5')

        temp = tempfile.NamedTemporaryFile(delete=False)
        temp.write(weights)
        temp.close()

        with h5py.File(temp.name, 'r') as f:
            model = KerasSequentialNet(plan)
            for (kind, arg), name in zip(plan, names):
                if kind == 'dense':
                    layer, _act, has_bias = arg
                    layer.weight.data = torch.from_numpy(np.array(f[f'layers/{name}/vars/0'])).t().float()
                    if has_bias:
                        layer.bias.data = torch.from_numpy(np.array(f[f'layers/{name}/vars/1'])).float()
                else:
                    layer = arg
                    layer.weight.data = torch.from_numpy(np.array(f[f'layers/{name}/vars/0'])).float()
                    layer.bias.data = torch.from_numpy(np.array(f[f'layers/{name}/vars/1'])).float()
                    layer.running_mean = torch.from_numpy(np.array(f[f'layers/{name}/vars/2'])).float()
                    layer.running_var = torch.from_numpy(np.array(f[f'layers/{name}/vars/3'])).float()
            model.eval()
            return model
    except Exception as e:
        logger.warning(f'Native PyTorch CREMA-D model loading warning: {e}')
        return None
    finally:
        if temp is not None:
            try:
                os.unlink(temp.name)
            except OSError:
                pass


class ModelManager:
    def __init__(self):
        self.ready = False
        self._load_lock = threading.Lock()
        self._loaded = threading.Event()
        self.load_error = None
        self.go_tokenizer = None
        self.go_model = None
        self.go_labels = {}
        self.suicide_tokenizer = None
        self.suicide_model = None
        self.suicide_labels = {}
        self.voice_model = None
        self.voice_scaler = None
        self.voice_encoder = None

    def load(self):
        """Load every model exactly once, safely from any thread.

        Startup kicks loading off in a background thread, so the very first
        inference request can arrive before the weights are ready. The lock plus
        the completed-event makes concurrent callers block until loading has
        actually finished instead of dereferencing a half-populated manager.
        """
        if self.ready:
            return
        with self._load_lock:
            if self.ready:
                return
            self._load_all()
            self.ready = True
            self._loaded.set()

    def _load_all(self):
        text_root = settings.model_root / 'text'
        voice_root = settings.model_root / 'voice' / 'cremad'

        try:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            self.go_tokenizer = AutoTokenizer.from_pretrained(text_root / 'goemotion', local_files_only=True)
            self.go_model = AutoModelForSequenceClassification.from_pretrained(text_root / 'goemotion', local_files_only=True)
            self.go_model.eval()
            self.go_labels = {int(k): v for k, v in json.loads((text_root / 'goemotion' / 'label_mapping.json').read_text())['id2label'].items()}

            self.suicide_tokenizer = AutoTokenizer.from_pretrained(text_root / 'suicide', local_files_only=True)
            self.suicide_model = AutoModelForSequenceClassification.from_pretrained(text_root / 'suicide', local_files_only=True)
            self.suicide_model.eval()
            self.suicide_labels = {int(k): v for k, v in json.loads((text_root / 'suicide' / 'label_mapping.json').read_text()).items()}
        except Exception as e:
            self.load_error = f'text: {type(e).__name__}: {e}'
            logger.error(f"Text model loading failed: {self.load_error}")

        try:
            self.voice_model = load_voice_model(voice_root)
            self.voice_scaler = joblib.load(voice_root / 'scaler.pkl')
            self.voice_encoder = joblib.load(voice_root / 'label_encoder.pkl')
            if self.voice_model is None:
                raise RuntimeError('no usable voice model artifact was found')
            logger.info("CREMA-D voice model loaded successfully via PyTorch runtime")
        except Exception as e:
            self.load_error = f'voice: {type(e).__name__}: {e}'
            logger.error(f"Voice model loading failed: {self.load_error}")

        logger.info('NeuroAI model loader initialization finished')

    def ensure_loaded(self):
        """Block until the background startup load has completed."""
        if not self.ready:
            self.load()
        else:
            self._loaded.wait(timeout=120)

    def text_models_ready(self) -> bool:
        return bool(self.go_model and self.go_tokenizer and self.go_labels)

    def suicide_models_ready(self) -> bool:
        return bool(self.suicide_model and self.suicide_tokenizer and self.suicide_labels)

    def voice_models_ready(self) -> bool:
        return bool(self.voice_model and self.voice_scaler and self.voice_encoder)

    def classify_text(self, text: str, model, tokenizer, labels: dict[int, str]):
        if model is None or tokenizer is None or not labels:
            raise RuntimeError('text model is not loaded')
        encoded = tokenizer(text, return_tensors='pt', truncation=True, max_length=512)
        with torch.no_grad():
            probabilities = torch.softmax(model(**encoded).logits[0], dim=-1).cpu().numpy()
        ranking = np.argsort(probabilities)[::-1]
        return [(labels[int(i)], float(probabilities[i])) for i in ranking]

model_manager = ModelManager()
