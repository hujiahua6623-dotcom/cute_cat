"""Persistence for garden event task progress."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.persistence.ids import new_id
from cute_cat.persistence.models import GardenEventProgress


async def load_by_garden(session: AsyncSession, garden_id: str) -> dict[str, GardenEventProgress]:
    q = await session.execute(select(GardenEventProgress).where(GardenEventProgress.garden_id == garden_id))
    rows = list(q.scalars().all())
    return {r.anchor_key: r for r in rows}


async def get_or_create_for_update(
    session: AsyncSession,
    *,
    garden_id: str,
    anchor_key: str,
    event_kind: str,
    pet_id: str | None,
) -> GardenEventProgress:
    q = await session.execute(
        select(GardenEventProgress)
        .where(
            GardenEventProgress.garden_id == garden_id,
            GardenEventProgress.anchor_key == anchor_key,
        )
        .with_for_update()
    )
    row = q.scalar_one_or_none()
    if row is not None:
        return row
    row = GardenEventProgress(
        id=new_id("gev"),
        garden_id=garden_id,
        anchor_key=anchor_key,
        event_kind=event_kind,
        pet_id=pet_id,
        progress={},
        completed=False,
    )
    session.add(row)
    await session.flush()
    return row
