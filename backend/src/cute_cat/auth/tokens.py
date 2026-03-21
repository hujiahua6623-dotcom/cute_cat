from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from jose import jwt

from cute_cat.config import Settings


def _refresh_material(refresh_token: str) -> str:
    return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()


def create_access_token(settings: Settings, user_id: str) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(seconds=settings.jwt_access_ttl_seconds)
    return jwt.encode(
        {"sub": user_id, "iat": int(now.timestamp()), "exp": int(exp.timestamp())},
        settings.jwt_secret,
        algorithm="HS256",
    )


def create_refresh_opaque() -> str:
    return f"rt_{secrets.token_urlsafe(32)}"


def hash_refresh(opaque: str) -> str:
    return _refresh_material(opaque)


def create_ws_ticket_jwt(
    settings: Settings,
    *,
    user_id: str,
    garden_id: str,
    jti: str,
) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(seconds=settings.ws_ticket_ttl_seconds)
    return jwt.encode(
        {
            "sub": user_id,
            "gid": garden_id,
            "jti": jti,
            "typ": "ws",
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_ws_ticket(settings: Settings, token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
