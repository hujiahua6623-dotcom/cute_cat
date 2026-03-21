"""Wall-clock to continuous game time (see doc/后端开发设计文档.md)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

# Real 1 hour = 2 game hours => 1 game hour = 1800 real seconds
REAL_SECONDS_PER_GAME_HOUR = 1800.0
GAME_HOURS_PER_GAME_DAY = 24.0


@dataclass(frozen=True)
class GameTime:
    game_day_index: int
    game_hour_float: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "gameDayIndex": self.game_day_index,
            "gameHourIndex": int(self.game_hour_float) % 24,
            "gameHourFloat": round(self.game_hour_float, 4),
        }


def parse_anchor(anchor_iso: str | None) -> datetime:
    if not anchor_iso:
        return datetime(1970, 1, 1, tzinfo=UTC)
    # Accept Z suffix
    s = anchor_iso.replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def get_game_time(now_wall_clock: datetime, *, anchor_wall_clock: datetime) -> GameTime:
    """Map wall clock to game day index and hour-in-day float.

    Rules: real 12h == 1 GameDay (24 game hours); real 1h == 2 game hours.
    """
    now_wall_clock = now_wall_clock.astimezone(UTC)
    anchor_wall_clock = anchor_wall_clock.astimezone(UTC)
    elapsed = (now_wall_clock - anchor_wall_clock).total_seconds()
    if elapsed < 0:
        elapsed = 0.0
    game_hours_total = elapsed / REAL_SECONDS_PER_GAME_HOUR
    day = int(game_hours_total // GAME_HOURS_PER_GAME_DAY)
    hour_in_day = game_hours_total - day * GAME_HOURS_PER_GAME_DAY
    return GameTime(game_day_index=day, game_hour_float=hour_in_day)
