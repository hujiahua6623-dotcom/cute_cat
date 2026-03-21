"""Interactive actions: Feed / Cuddle / Pat."""

from __future__ import annotations

from typing import Any

from cute_cat.game.stats import clamp_stat


DEFAULT_DEMO_FOOD_ID = "food_basic_01"


def apply_action(
    stats: dict[str, int],
    action_type: str,
    *,
    item_id: str | None,
) -> tuple[dict[str, int], str]:
    """Mutate stats in place; return (delta, animation_key)."""
    before = dict(stats)
    delta: dict[str, int] = {}

    if action_type == "Feed":
        if item_id is None:
            item_id = DEFAULT_DEMO_FOOD_ID
        # Period-1: optional itemId maps to same demo effect unless unknown
        food_power = 22 if item_id == DEFAULT_DEMO_FOOD_ID else 18
        stats["hunger"] = stats["hunger"] - food_power
        stats["mood"] = stats["mood"] + 4
        stats["loyalty"] = stats["loyalty"] + 2
        stats["health"] = stats["health"] + 2
        stats["sickLevel"] = max(0, stats["sickLevel"] - 1)
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
