from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ and repo root .env (config lives at backend/src/cute_cat/config.py)
_BACKEND_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Runtime configuration from environment (.env)."""

    model_config = SettingsConfigDict(
        env_file=(_BACKEND_DIR / ".env", _REPO_ROOT / ".env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = Field(..., validation_alias="DATABASE_URL")
    jwt_secret: str = Field(..., validation_alias="JWT_SECRET")
    jwt_access_ttl_seconds: int = Field(900, validation_alias="JWT_ACCESS_TTL_SECONDS")
    jwt_refresh_ttl_seconds: int = Field(604800, validation_alias="JWT_REFRESH_TTL_SECONDS")
    cors_origins: str = Field("http://localhost:5173", validation_alias="CORS_ORIGINS")

    # Optional anchor for game time (ISO 8601). If unset, uses Unix epoch.
    server_start_wall_clock: str | None = Field(None, validation_alias="SERVER_START_WALL_CLOCK")

    ws_ticket_ttl_seconds: int = Field(60, validation_alias="WS_TICKET_TTL_SECONDS")
    public_base_url: str = Field("http://localhost:8000", validation_alias="PUBLIC_BASE_URL")
    dashscope_api_key: str = Field("", validation_alias="DASHSCOPE_API_KEY")
    qwen_model: str = Field("qwen-plus", validation_alias="QWEN_MODEL")
    ai_timeout_seconds: float = Field(4.0, validation_alias="AI_TIMEOUT_SECONDS")

    api_prefix: str = "/api/v1"

    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
