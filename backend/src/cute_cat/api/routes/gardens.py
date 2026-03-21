from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.api.deps import CurrentUser
from cute_cat.api.schemas import WsTicketResponse
from cute_cat.auth.tokens import create_ws_ticket_jwt
from cute_cat.config import Settings, get_settings
from cute_cat.persistence.database import get_session
from cute_cat.persistence.models import Pet

router = APIRouter(prefix="/gardens", tags=["gardens"])


def _public_ws_base(settings: Settings) -> str:
    base = settings.public_base_url.rstrip("/")
    if base.startswith("https://"):
        return "wss://" + base[len("https://") :]
    if base.startswith("http://"):
        return "ws://" + base[len("http://") :]
    return base


@router.get("/ws-ticket", response_model=WsTicketResponse)
async def ws_ticket(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> WsTicketResponse:
    q = await session.execute(select(Pet).where(Pet.owner_user_id == user.id))
    pet = q.scalar_one_or_none()
    if pet is None:
        raise HTTPException(status_code=404, detail="Claim a pet before joining a garden")

    jti = secrets.token_hex(16)
    token = create_ws_ticket_jwt(
        settings,
        user_id=user.id,
        garden_id=pet.garden_id,
        jti=jti,
    )
    base = _public_ws_base(settings)
    ws_url = f"{base}{settings.api_prefix}/ws/garden"
    return WsTicketResponse(
        wsUrl=ws_url,
        ticket=token,
        expiresIn=settings.ws_ticket_ttl_seconds,
        gardenId=pet.garden_id,
    )
