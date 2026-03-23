from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.api.deps import CurrentUser
from cute_cat.api.errors import ApiError
from cute_cat.api.schemas import ShopBuyRequest, ShopBuyResponse
from cute_cat.game.economy import get_shop_item
from cute_cat.persistence.database import get_session
from cute_cat.services.inventory import add_inventory

router = APIRouter(prefix="/shop", tags=["shop"])


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

    return ShopBuyResponse(
        itemId=item.item_id,
        countAdded=body.count,
        inventoryCount=inv.count,
        coinsAfter=user.coins,
    )
