"""Rule-based offline summary (no LLM)."""

from __future__ import annotations

from typing import Any

from cute_cat.game.time import GameTime


def build_offline_summary(
    *,
    before: dict[str, int],
    after: dict[str, int],
    since: GameTime,
    until: GameTime,
) -> tuple[list[str], str]:
    """Return human-readable reasons and suggested action type."""
    reasons: list[str] = []
    dh = after["hunger"] - before["hunger"]
    dm = after["mood"] - before["mood"]
    dhlt = after["health"] - before["health"]
    sick_before = before["sickLevel"]
    sick_after = after["sickLevel"]

    if dh >= 8:
        reasons.append("因久未进食，饥饿明显上升")
    if dm <= -5:
        reasons.append("情绪有所下降")
    if dhlt <= -5:
        reasons.append("健康状况下滑")
    if sick_after > sick_before:
        reasons.append("出现了生病风险")

    if not reasons:
        reasons.append("离线期间状态略有波动")

    suggested = "Feed"
    if after["health"] < 35 or after["sickLevel"] >= 2:
        suggested = "TreatAtHospital"
    elif after["hunger"] >= 60:
        suggested = "Feed"
    elif after["mood"] < 35:
        suggested = "Cuddle"

    return reasons[:2], suggested


def offline_summary_payload(
    *,
    pet_id: str,
    reasons: list[str],
    suggested_action: str,
    since: GameTime,
    until: GameTime,
) -> dict[str, Any]:
    return {
        "petId": pet_id,
        "reasons": reasons,
        "suggestedActionType": suggested_action,
        "sinceGameTime": {
            "gameDayIndex": since.game_day_index,
            "gameHourFloat": round(since.game_hour_float, 4),
        },
        "untilGameTime": {
            "gameDayIndex": until.game_day_index,
            "gameHourFloat": round(until.game_hour_float, 4),
        },
    }
