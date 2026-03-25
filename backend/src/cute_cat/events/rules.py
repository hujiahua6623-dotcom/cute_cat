"""Pure scheduling rules for birthday anniversaries and garden social windows."""

from __future__ import annotations

import hashlib

from cute_cat.events.constants import SOCIAL_PERIOD_GAME_DAYS, SOCIAL_SPAN_GAME_DAYS, YEAR_GAME_DAYS


def garden_social_phase(garden_id: str) -> int:
    digest = hashlib.sha256(garden_id.encode("utf-8")).hexdigest()
    return int(digest, 16) % SOCIAL_PERIOD_GAME_DAYS


def social_window_bounds(game_day_index: int, garden_id: str) -> tuple[bool, int | None]:
    """Return (in_window, window_start_game_day). window_start is the first day of the 2-day span."""
    phase = garden_social_phase(garden_id)
    r = (game_day_index - phase) % SOCIAL_PERIOD_GAME_DAYS
    if r < SOCIAL_SPAN_GAME_DAYS:
        window_start = game_day_index - r
        return True, window_start
    return False, None


def is_birthday_anniversary_day(game_day_index: int, birthday_game_day: int) -> bool:
    if game_day_index < birthday_game_day:
        return False
    return (game_day_index - birthday_game_day) % YEAR_GAME_DAYS == 0
