"""
Configuration module for PolicySetu AI.
Loads settings from environment variables and .env file.
"""

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    BASE_DIR: Path = BASE_DIR

    # --- Server Settings ---
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    BASE_PUBLIC_URL: str = "http://localhost:8000"
    ENVIRONMENT: str = "development"

    # --- Indic Speech & Translation (Sarvam AI) ---
    SARVAM_API_KEY: Optional[str] = None
    SARVAM_API_BASE_URL: str = "https://api.sarvam.ai"

    # --- LLM Orchestration & Embeddings (Google Gemini) ---
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_EMBEDDING_MODEL: str = "models/gemini-embedding-001"

    # --- Live Vector Store (Qdrant) ---
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "policy_mandates"

    # --- Session & Media Store (Supabase) ---
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "voice-notes"

    # --- Live Public Government Data ---
    DATA_GOV_IN_API_KEY: Optional[str] = None
    GOOGLE_PLACES_API_KEY: Optional[str] = None

    # Paths
    STORAGE_DIR: Path = BASE_DIR / "data" / "storage"
    AUDIO_DIR: Path = BASE_DIR / "data" / "audio"
    SQLITE_DB_PATH: Path = BASE_DIR / "data" / "telemetry.db"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def is_sarvam_configured(self) -> bool:
        return bool(self.SARVAM_API_KEY and self.SARVAM_API_KEY.strip())

    def is_gemini_configured(self) -> bool:
        return bool(self.GEMINI_API_KEY and self.GEMINI_API_KEY.strip())

    def is_qdrant_configured(self) -> bool:
        return bool(self.QDRANT_URL and self.QDRANT_URL.strip())

    def is_supabase_configured(self) -> bool:
        return bool(self.SUPABASE_URL and self.SUPABASE_SERVICE_ROLE_KEY)


settings = Settings()

# Ensure local directories exist
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
settings.SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
