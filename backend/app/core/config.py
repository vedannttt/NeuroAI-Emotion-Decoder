from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).parents[2] / '.env', extra='ignore')
    app_name: str = 'NeuroAI Emotion Decoder API'
    environment: str = 'development'
    database_url: str = 'sqlite+aiosqlite:///./neuroai.db'
    redis_url: str | None = None
    jwt_secret: str = 'development-only-change-me-before-deploying'
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    cors_origins: str = 'http://localhost:5173'
    max_upload_bytes: int = 26_214_400
    model_root: Path = Path(__file__).parents[2] / 'models'
settings = Settings()
