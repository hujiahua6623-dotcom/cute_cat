"""Cycle-2 economy constants and helpers."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ShopItem:
    item_id: str
    item_type: str
    name: str
    price_coins: int
    feed_power: int
    mood_bonus: int
    loyalty_bonus: int
    health_bonus: int


SHOP_ITEMS: dict[str, ShopItem] = {
    "food_basic_01": ShopItem(
        item_id="food_basic_01",
        item_type="food",
        name="Basic Kibble",
        price_coins=12,
        feed_power=22,
        mood_bonus=4,
        loyalty_bonus=2,
        health_bonus=2,
    ),
    "food_fancy_01": ShopItem(
        item_id="food_fancy_01",
        item_type="food",
        name="Fancy Feast",
        price_coins=26,
        feed_power=30,
        mood_bonus=7,
        loyalty_bonus=4,
        health_bonus=4,
    ),
}

HOSPITAL_TREAT_COST = 30


def get_shop_item(item_id: str) -> ShopItem | None:
    return SHOP_ITEMS.get(item_id)
