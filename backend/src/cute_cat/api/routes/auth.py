from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.api.deps import CurrentUser
from cute_cat.api.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from cute_cat.auth.passwords import hash_password, verify_password
from cute_cat.auth.tokens import (
    create_access_token,
    create_refresh_opaque,
    hash_refresh,
)
from cute_cat.config import Settings, get_settings
from cute_cat.persistence.database import get_session
from cute_cat.persistence.ids import new_id
from cute_cat.persistence.models import RefreshToken, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    exists = await session.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    uid = new_id("usr")
    user = User(
        id=uid,
        email=body.email,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
        coins=100,
    )
    session.add(user)

    opaque = create_refresh_opaque()
    rt_id = new_id("rft")
    exp = datetime.now(UTC) + timedelta(seconds=settings.jwt_refresh_ttl_seconds)
    session.add(
        RefreshToken(
            id=rt_id,
            user_id=uid,
            token_hash=hash_refresh(opaque),
            expires_at=exp,
            revoked=False,
            created_at=datetime.now(UTC),
        )
    )
    await session.commit()

    access = create_access_token(settings, uid)
    return TokenResponse(
        userId=uid,
        accessToken=access,
        accessExpiresIn=settings.jwt_access_ttl_seconds,
        refreshToken=opaque,
        refreshExpiresIn=settings.jwt_refresh_ttl_seconds,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    q = await session.execute(select(User).where(User.email == body.email))
    user = q.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    opaque = create_refresh_opaque()
    rt_id = new_id("rft")
    exp = datetime.now(UTC) + timedelta(seconds=settings.jwt_refresh_ttl_seconds)
    session.add(
        RefreshToken(
            id=rt_id,
            user_id=user.id,
            token_hash=hash_refresh(opaque),
            expires_at=exp,
            revoked=False,
            created_at=datetime.now(UTC),
        )
    )
    await session.commit()

    access = create_access_token(settings, user.id)
    return TokenResponse(
        userId=user.id,
        accessToken=access,
        accessExpiresIn=settings.jwt_access_ttl_seconds,
        refreshToken=opaque,
        refreshExpiresIn=settings.jwt_refresh_ttl_seconds,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    th = hash_refresh(body.refreshToken)
    q = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == th, RefreshToken.revoked.is_(False))
    )
    row = q.scalar_one_or_none()
    if row is None or row.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    row.revoked = True
    opaque = create_refresh_opaque()
    rt_id = new_id("rft")
    exp = datetime.now(UTC) + timedelta(seconds=settings.jwt_refresh_ttl_seconds)
    session.add(
        RefreshToken(
            id=rt_id,
            user_id=row.user_id,
            token_hash=hash_refresh(opaque),
            expires_at=exp,
            revoked=False,
            created_at=datetime.now(UTC),
        )
    )
    await session.commit()

    access = create_access_token(settings, row.user_id)
    return TokenResponse(
        accessToken=access,
        accessExpiresIn=settings.jwt_access_ttl_seconds,
        refreshToken=opaque,
        refreshExpiresIn=settings.jwt_refresh_ttl_seconds,
    )


@router.post("/logout", status_code=204)
async def logout(
    body: LogoutRequest,
    session: AsyncSession = Depends(get_session),
) -> None:
    th = hash_refresh(body.refreshToken)
    q = await session.execute(select(RefreshToken).where(RefreshToken.token_hash == th))
    row = q.scalar_one_or_none()
    if row:
        row.revoked = True
        await session.commit()
