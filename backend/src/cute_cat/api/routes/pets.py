from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.api.deps import CurrentUser
from cute_cat.api.schemas import ClaimPetRequest, ClaimPetResponse, OfflineSummaryResponse, PetSnapshotResponse
from cute_cat.config import Settings, get_settings
from cute_cat.game.offline import build_offline_summary, offline_summary_payload
from cute_cat.game.stats import default_stats, stability_snapshot
from cute_cat.game.time import get_game_time, parse_anchor
from cute_cat.persistence.database import get_session
from cute_cat.persistence.ids import new_id
from cute_cat.persistence.models import Garden, Pet
from cute_cat.services.pet_state import get_pet_for_owner, reconcile_pet_now, snapshot_game_time

router = APIRouter(tags=["pets"])
SHARED_GARDEN_ID = "gdn_shared_mvp_01"


@router.post("/pets/claim", status_code=201, response_model=ClaimPetResponse)
async def claim_pet(
    body: ClaimPetRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ClaimPetResponse:
    existing = await session.execute(select(Pet).where(Pet.owner_user_id == user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Pet already claimed")

    gid = SHARED_GARDEN_ID
    existing_garden = await session.get(Garden, gid)
    if existing_garden is None:
        session.add(Garden(id=gid))

    anchor = parse_anchor(settings.server_start_wall_clock)
    now = datetime.now(UTC)
    gt = get_game_time(now, anchor_wall_clock=anchor)

    pid = new_id("pet")
    pos_h = abs(hash(pid))
    pet = Pet(
        id=pid,
        owner_user_id=user.id,
        garden_id=gid,
        pet_name=body.petName,
        pet_type=body.petType,
        skin_seed=pos_h % 1_000_000,
        growth_stage=0,
        birthday_game_day=gt.game_day_index,
        stats=default_stats(),
        # Spawn on the walkable grass band (aligns with frontend garden art); x spread avoids overlap.
        position={
            "x": round(0.15 + (pos_h % 7000) / 10000.0, 4),
            "y": round(0.62 + ((pos_h // 7000) % 1801) / 10000.0, 4),
        },
        sick_window=[],
        diet_history=[],
        last_game_day_index=gt.game_day_index,
        consecutive_stable_days=0,
        memory_summary="",
        memory_milestones=[],
        memory_last_updated_at=None,
        state_version=1,
        last_seen_wall_clock=now,
    )
    session.add(pet)
    await session.commit()

    return ClaimPetResponse(
        petId=pid,
        gardenId=gid,
        petType=body.petType,
        skinSeed=pet.skin_seed,
        birthdayGameDay=gt.game_day_index,
    )


@router.get("/pets/{pet_id}", response_model=PetSnapshotResponse)
async def get_pet(
    pet_id: str,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> PetSnapshotResponse:
    pet = await get_pet_for_owner(session, user.id, pet_id)
    if pet is None:
        raise HTTPException(status_code=404, detail="Pet not found")

    reconcile_pet_now(pet, settings)
    await session.commit()

    now = datetime.now(UTC)
    return PetSnapshotResponse(
        petId=pet.id,
        ownerUserId=pet.owner_user_id,
        petName=pet.pet_name,
        petType=pet.pet_type,
        skinSeed=pet.skin_seed,
        growthStage=pet.growth_stage,
        gameTime=snapshot_game_time(settings, now),
        stats=pet.stats,
        stability={
            **stability_snapshot(pet.stats, pet.sick_window or []),
            "consecutiveStableDays": pet.consecutive_stable_days,
            "lastGameDayIndex": pet.last_game_day_index,
        },
        memory={
            "summary": pet.memory_summary or "",
            "milestones": list(pet.memory_milestones or []),
            "lastUpdatedAt": (
                pet.memory_last_updated_at.isoformat().replace("+00:00", "Z")
                if pet.memory_last_updated_at is not None
                else None
            ),
        },
    )


@router.get("/offline-summary", response_model=OfflineSummaryResponse)
async def offline_summary(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    pet_id: str = Query(..., alias="petId"),
) -> OfflineSummaryResponse:
    pet = await get_pet_for_owner(session, user.id, pet_id)
    if pet is None:
        raise HTTPException(status_code=404, detail="Pet not found")

    anchor = parse_anchor(settings.server_start_wall_clock)
    now = datetime.now(UTC)
    since_gt = get_game_time(pet.last_seen_wall_clock, anchor_wall_clock=anchor)
    until_gt = get_game_time(now, anchor_wall_clock=anchor)

    rec = reconcile_pet_now(pet, settings, now=now)
    reasons, suggested = build_offline_summary(
        before=rec.before,
        after=rec.after,
        since=since_gt,
        until=until_gt,
    )
    await session.commit()

    payload = offline_summary_payload(
        pet_id=pet.id,
        reasons=reasons,
        suggested_action=suggested,
        since=since_gt,
        until=until_gt,
    )
    return OfflineSummaryResponse.model_validate(payload)
