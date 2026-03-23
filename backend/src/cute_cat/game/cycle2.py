"""Cycle-2 growth and sickness helpers."""

from __future__ import annotations

from typing import Any


def append_diet_history(
    diet_history: list[dict[str, Any]] | list[Any],
    *,
    game_day_index: int,
    item_id: str,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for row in diet_history or []:
        if isinstance(row, dict) and "gameDayIndex" in row and "itemId" in row:
            rows.append({"gameDayIndex": int(row["gameDayIndex"]), "itemId": str(row["itemId"])})
    rows.append({"gameDayIndex": int(game_day_index), "itemId": item_id})
    return rows[-12:]


def has_diet_shift_risk(diet_history: list[dict[str, Any]] | list[Any], *, now_day_index: int) -> bool:
    recent = [
        row
        for row in (diet_history or [])
        if isinstance(row, dict) and int(row.get("gameDayIndex", -9999)) >= now_day_index - 1
    ]
    if len(recent) < 3:
        return False
    distinct_items = {str(r.get("itemId")) for r in recent}
    return len(distinct_items) >= 2


def rollup_growth_days(
    *,
    stats: dict[str, int],
    sick_window: list[Any],
    growth_stage: int,
    consecutive_stable_days: int,
    last_game_day_index: int,
    now_game_day_index: int,
) -> tuple[list[bool], int, int, int]:
    window = [bool(x) for x in (sick_window or [])][-4:]
    consecutive = int(consecutive_stable_days)
    stage = int(growth_stage)
    last_day = int(last_game_day_index)

    if now_game_day_index <= last_day:
        return window, consecutive, stage, last_day

    for day in range(last_day + 1, now_game_day_index + 1):
        day_had_sick = int(stats.get("sickLevel", 0)) > 0
        window.append(day_had_sick)
        window = window[-4:]

        health_stable = 1.0 if int(stats.get("health", 0)) >= 55 else 0.0
        mood_stable = 1.0 if int(stats.get("mood", 0)) >= 30 else 0.0
        score = 0.4 * health_stable + 0.6 * mood_stable
        sick_count = 1 if any(window) else 0
        day_success = score >= 1.0 and sick_count == 0

        if day_success:
            consecutive += 1
            if consecutive >= 2:
                stage += 1
                consecutive = 0
        else:
            consecutive = 0
        last_day = day

    return window, consecutive, stage, last_day
