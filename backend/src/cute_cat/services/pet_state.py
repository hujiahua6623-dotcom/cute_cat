"""Load/reconcile pet state for HTTP handlers."""

from __future__ import annotations

import copy
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.config import Settings
from cute_cat.game.stats import ReconcileResult, reconcile_pet_stats
from cute_cat.game.time import get_game_time, parse_anchor
from cute_cat.persistence.models import Pet


async def get_pet_for_owner(session: AsyncSession, owner_id: str, pet_id: str) -> Pet | None:
    q = await session.execute(select(Pet).where(Pet.id == pet_id, Pet.owner_user_id == owner_id))
    return q.scalar_one_or_none()


def reconcile_pet_now(pet: Pet, settings: Settings, now: datetime | None = None) -> ReconcileResult:
    """Apply passive decay from last_seen to now and bump version."""
    now = now or datetime.now(UTC)
    stats_work = copy.deepcopy(pet.stats)
    rec = reconcile_pet_stats(stats_work, pet.last_seen_wall_clock, now)
    pet.stats = rec.after
    pet.last_seen_wall_clock = now
    pet.state_version = pet.state_version + 1
    return rec


def snapshot_game_time(settings: Settings, at: datetime) -> dict:
    anchor = parse_anchor(settings.server_start_wall_clock)
    gt = get_game_time(at, anchor_wall_clock=anchor)
    return gt.as_dict()
