from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.api.deps import CurrentUser
from cute_cat.api.errors import ApiError
from cute_cat.api.schemas import (
    InventoryItemResponse,
    InventoryListResponse,
    ShopBuyRequest,
    ShopBuyResponse,
)
from cute_cat.game.economy import get_shop_item
from cute_cat.persistence.database import get_session
from cute_cat.persistence.models import Pet
from cute_cat.realtime.garden_hub import hub
from cute_cat.services.inventory import add_inventory, list_inventories

router = APIRouter(prefix="/shop", tags=["shop"])


async def _push_inventory_changed_if_online(
    *,
    user_id: str,
    garden_id: str,
    item_id: str,
    count: int,
) -> None:
    conn = hub.by_user.get(user_id)
    if conn is None or conn.garden_id != garden_id:
        return
    try:
        await conn.websocket.send_json(
            {
                "type": "inventoryChanged",
                "payload": {"itemId": item_id, "count": int(count)},
            }
        )
    except Exception:
        # Push is best-effort and must not break purchase flow.
        return


@router.get("/inventory", response_model=InventoryListResponse)
async def get_inventory_list(
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> InventoryListResponse:
    rows = await list_inventories(session, user_id=user.id)
    return InventoryListResponse(
        items=[InventoryItemResponse(itemId=row.item_id, count=int(row.count)) for row in rows]
    )


@router.post("/buy", response_model=ShopBuyResponse)
async def buy_item(
    body: ShopBuyRequest,
    user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ShopBuyResponse:
    item = get_shop_item(body.itemId)
    if item is None:
        raise ApiError("BAD_REQUEST", "Unknown itemId", status_code=400)
    total_cost = item.price_coins * body.count
    if user.coins < total_cost:
        raise ApiError("BAD_REQUEST", "Insufficient coins", status_code=400)

    user.coins -= total_cost
    inv = await add_inventory(
        session,
        user_id=user.id,
        item_id=item.item_id,
        count=body.count,
    )
    await session.commit()
    pet_garden_q = await session.execute(select(Pet.garden_id).where(Pet.owner_user_id == user.id).limit(1))
    garden_id = pet_garden_q.scalar_one_or_none()
    if garden_id:
        await _push_inventory_changed_if_online(
            user_id=user.id,
            garden_id=str(garden_id),
            item_id=item.item_id,
            count=inv.count,
        )

    return ShopBuyResponse(
        itemId=item.item_id,
        countAdded=body.count,
        inventoryCount=inv.count,
        coinsAfter=user.coins,
    )
