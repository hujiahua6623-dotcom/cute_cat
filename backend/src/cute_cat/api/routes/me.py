from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.api.deps import CurrentUser
from cute_cat.api.schemas import MeResponse
from cute_cat.persistence.database import get_session
from cute_cat.persistence.models import Pet

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse)
async def me(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> MeResponse:
    q = await session.execute(select(Pet).where(Pet.owner_user_id == user.id))
    pet = q.scalar_one_or_none()
    return MeResponse(
        userId=user.id,
        nickname=user.nickname,
        coins=user.coins,
        petId=pet.id if pet else None,
        gardenId=pet.garden_id if pet else None,
    )
