"""Static event templates (MVP)."""

from __future__ import annotations

from cute_cat.events.constants import (
    BIRTHDAY_CUDDLE_TARGET,
    SOCIAL_FEED_TARGET,
    TEMPLATE_BIRTHDAY_V1,
    TEMPLATE_SOCIAL_V1,
)


def birthday_tasks_wire() -> list[dict[str, object]]:
    return [
        {
            "taskId": "cuddle_count",
            "label": "今日抱抱",
            "current": 0,
            "target": BIRTHDAY_CUDDLE_TARGET,
            "scope": "pet",
        }
    ]


def social_tasks_wire() -> list[dict[str, object]]:
    return [
        {
            "taskId": "feed_total",
            "label": "花园累计喂食",
            "current": 0,
            "target": SOCIAL_FEED_TARGET,
            "scope": "garden",
        }
    ]


def birthday_template_id() -> str:
    return TEMPLATE_BIRTHDAY_V1


def social_template_id() -> str:
    return TEMPLATE_SOCIAL_V1
