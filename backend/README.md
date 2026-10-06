# NeuroAI Emotion Decoder API

Production-oriented FastAPI inference service for the supplied **read-only pretrained** models. No training routines are included.

## Model inventory

| Service | Runtime | Loaded artifacts |
|---|---|---|
| GoEmotions | PyTorch / Transformers | RoBERTa weights, tokenizer, supplied `label_mapping.json` |
| Suicide detection | PyTorch / Transformers | RoBERTa weights, tokenizer, supplied risk mapping |
| Voice emotion | TensorFlow / Keras | Keras model, scaler, label encoder |

Models live under `models/` and are loaded once during FastAPI lifespan startup. The Docker runtime mounts this directory read-only.

## Local run

```bash
cd backend
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `/docs` for Swagger. For PostgreSQL and Redis, set `DATABASE_URL` as in `.env.example`, then run `docker compose up --build`.

## API

- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`
- `POST /api/text/analyze`
- `POST /api/voice/analyze` (multipart `audio`; WAV, MP3, M4A; 25 MB default)
- `POST /api/phq9/analyze`
- `POST /api/fusion/analyze`
- `GET /api/reports/history`, `GET /api/health`

All analysis endpoints require a Bearer access token. Voice inference mirrors the original training pipeline: 22050 Hz load, silence trim, normalization, and time-mean MFCC (40), chroma (12), mel spectrogram (128), zero-crossing rate, RMS, and spectral contrast (7), producing the scaler/model's 189 features.

## Safety

PHQ-9 and classifier outputs are informational only, not diagnosis. An elevated self-harm signal returns immediate safety guidance, but should be paired with an application-level crisis escalation flow appropriate to the deployment region.
