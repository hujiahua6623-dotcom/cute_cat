from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from cute_cat.api.deps import CurrentUser
from cute_cat.api.errors import ApiError
from cute_cat.api.schemas import HospitalTreatRequest, HospitalTreatResponse
from cute_cat.config import Settings, get_settings
from cute_cat.game.economy import HOSPITAL_TREAT_COST
from cute_cat.game.stats import clamp_stat
from cute_cat.persistence.database import get_session
from cute_cat.services.pet_state import get_pet_for_owner, reconcile_pet_now

router = APIRouter(prefix="/hospital", tags=["hospital"])


@router.post("/treat", response_model=HospitalTreatResponse)
async def treat_pet(
    body: HospitalTreatRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> HospitalTreatResponse:
    pet = await get_pet_for_owner(session, user.id, body.petId)
    if pet is None:
        raise ApiError("NOT_FOUND", "Pet not found", status_code=404)

    reconcile_pet_now(pet, settings=settings)
    if int(pet.stats.get("sickLevel", 0)) <= 0:
        raise ApiError("BAD_REQUEST", "Pet is not sick", status_code=400)
    if user.coins < HOSPITAL_TREAT_COST:
        raise ApiError("BAD_REQUEST", "Insufficient coins", status_code=400)

    before = {k: int(v) for k, v in pet.stats.items()}
    user.coins -= HOSPITAL_TREAT_COST
    pet.stats["sickLevel"] = max(0, int(pet.stats["sickLevel"]) - 2)
    pet.stats["health"] = int(pet.stats["health"]) + 10
    clamp_stat(pet.stats, "health")
    clamp_stat(pet.stats, "sickLevel", 0, 3)
    flag_modified(pet, "stats")
    pet.state_version += 1

    delta: dict[str, int] = {}
    for key, old in before.items():
        new = int(pet.stats.get(key, old))
        if new != old:
            delta[key] = new - old

    await session.commit()
    return HospitalTreatResponse(
        petId=pet.id,
        treatCost=HOSPITAL_TREAT_COST,
        coinsAfter=user.coins,
        stats=pet.stats,
        delta=delta,
    )
