"""Interactive actions: Feed / Cuddle / Pat."""

from __future__ import annotations

from cute_cat.game.stats import clamp_stat
from cute_cat.game.economy import ShopItem


def apply_action(
    stats: dict[str, int],
    action_type: str,
    *,
    item: ShopItem | None,
) -> tuple[dict[str, int], str]:
    """Mutate stats in place; return (delta, animation_key)."""
    before = dict(stats)
    delta: dict[str, int] = {}

    if action_type == "Feed":
        if item is None:
            raise ValueError("Feed requires a valid food item")
        stats["hunger"] = stats["hunger"] - item.feed_power
        stats["mood"] = stats["mood"] + item.mood_bonus
        stats["loyalty"] = stats["loyalty"] + item.loyalty_bonus
        stats["health"] = stats["health"] + item.health_bonus
    elif action_type == "Cuddle":
        stats["mood"] = stats["mood"] + 10
        stats["loyalty"] = stats["loyalty"] + 6
        stats["health"] = stats["health"] + 1
    elif action_type == "Pat":
        stats["mood"] = stats["mood"] + 6
        stats["loyalty"] = stats["loyalty"] + 4
    else:
        raise ValueError(f"Unsupported action in period 1: {action_type}")

    for k in ("hunger", "health", "mood", "loyalty"):
        clamp_stat(stats, k)
    clamp_stat(stats, "sickLevel", 0, 3)

    for k in stats:
        d = int(stats[k]) - int(before[k])
        if d != 0:
            delta[k] = d

    anim = {
        "Feed": "feed_default",
        "Cuddle": "cuddle_default",
        "Pat": "pat_default",
    }.get(action_type, "unknown")

    return delta, anim
