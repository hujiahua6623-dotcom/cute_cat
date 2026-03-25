"""Build activeEvents list for gardenSnapshot (camelCase wire)."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from cute_cat.events.constants import TEMPLATE_BIRTHDAY_V1, TEMPLATE_DAILY_V1, TEMPLATE_SOCIAL_V1
from cute_cat.events.templates import birthday_tasks_wire, daily_tasks_wire, social_tasks_wire
from cute_cat.events.progress_repo import load_by_garden
from cute_cat.events.rules import is_birthday_anniversary_day, social_window_bounds
from cute_cat.game.time import GameTime
from cute_cat.persistence.models import GardenEventProgress, Pet


def _merge_tasks(
    template_tasks: list[dict[str, Any]],
    prog: GardenEventProgress | None,
    task_keys: tuple[str, ...],
) -> list[dict[str, Any]]:
    data = dict(prog.progress) if prog and prog.progress else {}
    out: list[dict[str, Any]] = []
    for row in template_tasks:
        tid = str(row["taskId"])
        if tid in task_keys:
            cur = int(data.get(tid, 0))
            merged = {**row, "current": cur}
        else:
            merged = dict(row)
        out.append(merged)
    return out


def _ends_social(window_start: int) -> dict[str, float | int]:
    from cute_cat.events.constants import SOCIAL_SPAN_GAME_DAYS

    last_day = window_start + SOCIAL_SPAN_GAME_DAYS - 1
    return {"gameDayIndex": last_day, "gameHourFloat": 24.0}


def _ends_birthday(day: int) -> dict[str, float | int]:
    return {"gameDayIndex": day, "gameHourFloat": 24.0}


def _ends_daily(day: int) -> dict[str, float | int]:
    return {"gameDayIndex": day, "gameHourFloat": 24.0}


async def build_active_events(
    session: AsyncSession,
    *,
    garden_id: str,
    pets: list[Pet],
    gt: GameTime,
) -> list[dict[str, Any]]:
    by_anchor = await load_by_garden(session, garden_id)
    out: list[dict[str, Any]] = []
    day = gt.game_day_index

    in_social, window_start = social_window_bounds(day, garden_id)
    if in_social and window_start is not None:
        anchor = f"social:{garden_id}:{window_start}"
        prog = by_anchor.get(anchor)
        if prog and prog.completed:
            pass
        else:
            base = social_tasks_wire()
            tasks = _merge_tasks(list(base), prog, ("feed_total",))
            event_id = f"evt_social_{garden_id}_{window_start}"
            out.append(
                {
                    "eventId": event_id,
                    "eventType": "social",
                    "phase": "started",
                    "templateId": TEMPLATE_SOCIAL_V1,
                    "gardenId": garden_id,
                    "title": "花园小聚",
                    "message": "和大家一起完成投喂目标吧（占位）",
                    "tasks": tasks,
                    "endsAtGameTime": _ends_social(window_start),
                }
            )

    for pet in pets:
        daily_anchor = f"daily:{pet.id}:{day}"
        daily_prog = by_anchor.get(daily_anchor)
        if not (daily_prog and daily_prog.completed):
            daily_tasks = _merge_tasks(list(daily_tasks_wire()), daily_prog, ("pat_count",))
            daily_event_id = f"evt_daily_{pet.id}_{day}"
            out.append(
                {
                    "eventId": daily_event_id,
                    "eventType": "daily",
                    "phase": "started",
                    "templateId": TEMPLATE_DAILY_V1,
                    "gardenId": garden_id,
                    "petId": pet.id,
                    "ownerUserId": pet.owner_user_id,
                    "title": "每日互动任务",
                    "message": "今日摸头达标可领取金币奖励",
                    "tasks": daily_tasks,
                    "endsAtGameTime": _ends_daily(day),
                }
            )

        if not is_birthday_anniversary_day(day, pet.birthday_game_day):
            continue
        anchor = f"birthday:{pet.id}:{day}"
        prog = by_anchor.get(anchor)
        if prog and prog.completed:
            continue
        base = birthday_tasks_wire()
        tasks = _merge_tasks(list(base), prog, ("cuddle_count",))
        event_id = f"evt_birthday_{pet.id}_{day}"
        out.append(
            {
                "eventId": event_id,
                "eventType": "birthday",
                "phase": "started",
                "templateId": TEMPLATE_BIRTHDAY_V1,
                "gardenId": garden_id,
                "petId": pet.id,
                "ownerUserId": pet.owner_user_id,
                "title": "生日快乐",
                "message": "今天多陪陪它吧（占位）",
                "tasks": tasks,
                "endsAtGameTime": _ends_birthday(day),
            }
        )

    return out
