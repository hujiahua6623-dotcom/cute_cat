"""Pet stats helpers, passive decay, and simplified stability (period 1)."""

from __future__ import annotations

import copy
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any


def default_stats() -> dict[str, int]:
    return {
        "hunger": 50,
        "health": 80,
        "mood": 70,
        "loyalty": 40,
        "sickLevel": 0,
    }


def clamp_stat(stats: dict[str, int], key: str, lo: int = 0, hi: int = 100) -> None:
    stats[key] = int(max(lo, min(hi, stats[key])))


def apply_passive_decay(stats: dict[str, int], game_hours: float) -> None:
    """Apply passive changes for elapsed *game* hours (not wall hours)."""
    if game_hours <= 0:
        return
    gh = min(game_hours, 24.0 * 14)  # cap at 14 game days per tick to avoid extreme jumps
    # Hunger rises when not fed
    stats["hunger"] += int(round(2.2 * gh))
    stats["mood"] -= int(round(0.9 * gh))
    if stats["hunger"] > 70:
        stats["health"] -= int(round(0.4 * gh))
    if stats["hunger"] > 85:
        stats["health"] -= int(round(0.6 * gh))
    if stats["mood"] < 25:
        stats["health"] -= int(round(0.3 * gh))
    if stats["hunger"] > 90 and stats["sickLevel"] < 3:
        stats["sickLevel"] = min(3, stats["sickLevel"] + 1)

    for k in ("hunger", "health", "mood", "loyalty"):
        clamp_stat(stats, k)
    clamp_stat(stats, "sickLevel", 0, 3)


@dataclass
class ReconcileResult:
    before: dict[str, int]
    after: dict[str, int]
    elapsed_game_hours: float


def elapsed_game_hours_between(start: datetime, end: datetime) -> float:
    start = start.astimezone(UTC)
    end = end.astimezone(UTC)
    sec = max(0.0, (end - start).total_seconds())
    return sec / 1800.0  # REAL_SECONDS_PER_GAME_HOUR


def reconcile_pet_stats(
    stats_json: dict[str, Any],
    last_seen: datetime,
    now: datetime,
) -> ReconcileResult:
    """Return before/after snapshots; mutates stats_json to *after* state."""
    before = copy.deepcopy(stats_json)
    for k, v in list(before.items()):
        before[k] = int(v)
    elapsed = elapsed_game_hours_between(last_seen, now)
    apply_passive_decay(stats_json, elapsed)
    for k, v in list(stats_json.items()):
        stats_json[k] = int(v)
    return ReconcileResult(before=before, after=stats_json, elapsed_game_hours=elapsed)


def stability_snapshot(stats: dict[str, int], sick_window: list[Any]) -> dict[str, Any]:
    """Period-1 simplified stability; full window logic arrives in cycle 2."""
    h = stats["health"]
    m = stats["mood"]
    health_stable = 1.0 if h >= 55 else 0.0
    mood_stable = 1.0 if m >= 30 else 0.0
    score = 0.4 * health_stable + 0.6 * mood_stable
    flags = [bool(x) for x in sick_window][-4:] if sick_window else []
    sick_count = 1 if any(flags) else 0
    return {
        "stabilityScore": round(score, 4),
        "windowGameDays": 4,
        "sickCountInWindow": sick_count,
    }
