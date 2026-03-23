from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.persistence.ids import new_id
from cute_cat.persistence.models import Inventory


async def get_inventory(session: AsyncSession, user_id: str, item_id: str) -> Inventory | None:
    q = await session.execute(
        select(Inventory).where(Inventory.user_id == user_id, Inventory.item_id == item_id)
    )
    return q.scalar_one_or_none()


async def add_inventory(
    session: AsyncSession,
    *,
    user_id: str,
    item_id: str,
    count: int,
) -> Inventory:
    inv = await get_inventory(session, user_id, item_id)
    if inv is None:
        inv = Inventory(id=new_id("inv"), user_id=user_id, item_id=item_id, count=max(0, count))
        session.add(inv)
        return inv
    inv.count = max(0, int(inv.count) + int(count))
    return inv


async def consume_inventory(
    session: AsyncSession,
    *,
    user_id: str,
    item_id: str,
    count: int,
) -> Inventory | None:
    inv = await get_inventory(session, user_id, item_id)
    if inv is None or inv.count < count:
        return None
    inv.count -= count
    return inv
