"""Mutate event progress after petAction; emit broadcast payloads."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from cute_cat.events.constants import (
    BIRTHDAY_CUDDLE_TARGET,
    BIRTHDAY_REWARD_COINS,
    DAILY_PAT_TARGET,
    DAILY_REWARD_COINS,
    SOCIAL_FEED_TARGET,
    SOCIAL_REWARD_COINS,
    TEMPLATE_BIRTHDAY_V1,
    TEMPLATE_DAILY_V1,
    TEMPLATE_SOCIAL_V1,
)
from cute_cat.events.progress_repo import get_or_create_for_update
from cute_cat.events.rules import is_birthday_anniversary_day, social_window_bounds
from cute_cat.events.templates import birthday_tasks_wire, daily_tasks_wire, social_tasks_wire
from cute_cat.game.time import GameTime
from cute_cat.persistence.models import Pet, User


def _wire_tasks_from_progress(kind: str, prog_dict: dict[str, Any]) -> list[dict[str, Any]]:
    if kind == "social":
        base = social_tasks_wire()
    elif kind == "daily":
        base = daily_tasks_wire()
    else:
        base = birthday_tasks_wire()
    out = []
    for row in base:
        tid = str(row["taskId"])
        cur = int(prog_dict.get(tid, 0))
        out.append({**row, "current": cur})
    return out


async def apply_event_hooks_after_action(
    session: AsyncSession,
    *,
    garden_id: str,
    pet: Pet,
    actor_user_id: str,
    action_type: str,
    gt: GameTime,
) -> list[dict[str, Any]]:
    """Return eventBroadcast payloads (already camelCase) in order."""
    out: list[dict[str, Any]] = []
    day = gt.game_day_index

    if action_type == "Feed":
        in_social, window_start = social_window_bounds(day, garden_id)
        if not in_social or window_start is None:
            return out
        anchor = f"social:{garden_id}:{window_start}"
        row = await get_or_create_for_update(
            session, garden_id=garden_id, anchor_key=anchor, event_kind="social", pet_id=None
        )
        if row.completed:
            return out
        p = dict(row.progress or {})
        p["feed_total"] = int(p.get("feed_total", 0)) + 1
        row.progress = p
        flag_modified(row, "progress")
        event_id = f"evt_social_{garden_id}_{window_start}"
        out.append(
            {
                "eventId": event_id,
                "eventType": "social",
                "phase": "tick",
                "templateId": TEMPLATE_SOCIAL_V1,
                "gardenId": garden_id,
                "title": "花园小聚",
                "message": "投喂进度已更新（占位）",
                "tasks": _wire_tasks_from_progress("social", p),
            }
        )
        if p["feed_total"] >= SOCIAL_FEED_TARGET:
            row.completed = True
            u = await session.get(User, actor_user_id)
            if u is not None:
                u.coins = int(u.coins) + SOCIAL_REWARD_COINS
            out.append(
                {
                    "eventId": event_id,
                    "eventType": "social",
                    "phase": "ended",
                    "templateId": TEMPLATE_SOCIAL_V1,
                    "gardenId": garden_id,
                    "rewardsGranted": {"coins": SOCIAL_REWARD_COINS},
                }
            )

    if action_type == "Cuddle" and is_birthday_anniversary_day(day, pet.birthday_game_day):
        anchor = f"birthday:{pet.id}:{day}"
        row = await get_or_create_for_update(
            session, garden_id=garden_id, anchor_key=anchor, event_kind="birthday", pet_id=pet.id
        )
        if row.completed:
            return out
        p = dict(row.progress or {})
        p["cuddle_count"] = int(p.get("cuddle_count", 0)) + 1
        row.progress = p
        flag_modified(row, "progress")
        event_id = f"evt_birthday_{pet.id}_{day}"
        out.append(
            {
                "eventId": event_id,
                "eventType": "birthday",
                "phase": "tick",
                "templateId": TEMPLATE_BIRTHDAY_V1,
                "gardenId": garden_id,
                "petId": pet.id,
                "ownerUserId": pet.owner_user_id,
                "title": "生日快乐",
                "message": "抱抱进度已更新（占位）",
                "tasks": _wire_tasks_from_progress("birthday", p),
            }
        )
        if p["cuddle_count"] >= BIRTHDAY_CUDDLE_TARGET:
            row.completed = True
            u = await session.get(User, pet.owner_user_id)
            if u is not None:
                u.coins = int(u.coins) + BIRTHDAY_REWARD_COINS
            out.append(
                {
                    "eventId": event_id,
                    "eventType": "birthday",
                    "phase": "ended",
                    "templateId": TEMPLATE_BIRTHDAY_V1,
                    "gardenId": garden_id,
                    "petId": pet.id,
                    "ownerUserId": pet.owner_user_id,
                    "rewardsGranted": {"coins": BIRTHDAY_REWARD_COINS},
                }
            )

    if action_type == "Pat":
        anchor = f"daily:{pet.id}:{day}"
        row = await get_or_create_for_update(
            session, garden_id=garden_id, anchor_key=anchor, event_kind="daily", pet_id=pet.id
        )
        if row.completed:
            return out
        p = dict(row.progress or {})
        p["pat_count"] = int(p.get("pat_count", 0)) + 1
        row.progress = p
        flag_modified(row, "progress")
        event_id = f"evt_daily_{pet.id}_{day}"
        out.append(
            {
                "eventId": event_id,
                "eventType": "daily",
                "phase": "tick",
                "templateId": TEMPLATE_DAILY_V1,
                "gardenId": garden_id,
                "petId": pet.id,
                "ownerUserId": pet.owner_user_id,
                "title": "每日互动任务",
                "message": "每日摸头进度已更新",
                "tasks": _wire_tasks_from_progress("daily", p),
            }
        )
        if p["pat_count"] >= DAILY_PAT_TARGET:
            row.completed = True
            u = await session.get(User, pet.owner_user_id)
            if u is not None:
                u.coins = int(u.coins) + DAILY_REWARD_COINS
            out.append(
                {
                    "eventId": event_id,
                    "eventType": "daily",
                    "phase": "ended",
                    "templateId": TEMPLATE_DAILY_V1,
                    "gardenId": garden_id,
                    "petId": pet.id,
                    "ownerUserId": pet.owner_user_id,
                    "rewardsGranted": {"coins": DAILY_REWARD_COINS},
                }
            )

    return out
