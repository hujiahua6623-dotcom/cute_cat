from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import Any

from cute_cat.config import Settings
from cute_cat.persistence.models import Pet


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _fallback_event_text(event_type: str, phase: str, pet_name: str) -> dict[str, Any]:
    if event_type == "birthday":
        title = "生日快乐"
        message = "今天多陪陪它吧，完成互动就有奖励。"
        hints = ["先抱抱 1 次，确认进度已更新", "剩余目标优先在同一会话内完成"]
    elif event_type == "daily":
        title = "每日互动任务"
        message = "今日摸头达标可领取金币奖励。"
        hints = ["优先完成每日任务再进行商店消费", "进度接近达标时尽快补齐最后一次互动"]
    else:
        title = "花园小聚"
        message = "和大家一起推进花园协作进度。"
        hints = ["优先喂食推进花园总进度", "活动结束前检查是否已发放奖励"]
    if phase == "ended":
        hints = ["奖励已发放，可继续日常互动维持状态", "查看活动区确认下一条可做任务"]
    return {"title": title, "message": message, "narrativeSuggestions": hints}


async def _try_langchain_json(
    *,
    settings: Settings,
    instruction: str,
    context: dict[str, Any],
) -> dict[str, Any] | None:
    if not settings.dashscope_api_key:
        return None
    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI
    except Exception:
        return None

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", instruction),
            ("human", "context_json={context_json}"),
        ]
    )
    chain = prompt | ChatOpenAI(
        model=settings.qwen_model,
        api_key=settings.dashscope_api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        temperature=0.2,
    )
    result = await asyncio.wait_for(
        chain.ainvoke({"context_json": json.dumps(context, ensure_ascii=False)}),
        timeout=settings.ai_timeout_seconds,
    )
    content = getattr(result, "content", "")
    if isinstance(content, list):
        content = "".join(str(x) for x in content)
    text = str(content).strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.replace("json", "", 1).strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        return None
    return data


def _trim_suggestions(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        s = str(item).strip()
        if s:
            out.append(s[:80])
    return out[:3]


async def generate_event_text(
    *,
    settings: Settings,
    event_type: str,
    phase: str,
    pet_name: str,
    progress_current: int,
    progress_target: int,
) -> dict[str, Any]:
    fallback = _fallback_event_text(event_type, phase, pet_name)
    instruction = (
        "你是电子宠物游戏的受控文案生成器。"
        "只返回JSON对象，字段必须是 title,message,narrativeSuggestions。"
        "要求：简短、积极、不包含概率或数值改动建议。"
    )
    context = {
        "eventType": event_type,
        "phase": phase,
        "petName": pet_name,
        "progressCurrent": progress_current,
        "progressTarget": progress_target,
    }
    try:
        data = await _try_langchain_json(settings=settings, instruction=instruction, context=context)
    except Exception:
        data = None
    if not data:
        return fallback
    title = str(data.get("title", "")).strip()[:24]
    message = str(data.get("message", "")).strip()[:120]
    suggestions = _trim_suggestions(data.get("narrativeSuggestions"))
    if not title or not message:
        return fallback
    return {"title": title, "message": message, "narrativeSuggestions": suggestions or fallback["narrativeSuggestions"]}


async def generate_treatment_suggestions(settings: Settings, *, pet_name: str, delta: dict[str, int]) -> list[str]:
    fallback = [
        "治疗后先观察健康和情绪是否稳定。",
        "接下来优先进行温和互动，避免短时间内骤变操作。",
    ]
    instruction = (
        "你是电子宠物治疗后建议生成器。"
        "仅返回JSON对象，字段 narrativeSuggestions 为字符串数组。"
        "不能给出修改经济/概率参数的建议。"
    )
    context = {"petName": pet_name, "delta": delta}
    try:
        data = await _try_langchain_json(settings=settings, instruction=instruction, context=context)
    except Exception:
        data = None
    if not data:
        return fallback
    hints = _trim_suggestions(data.get("narrativeSuggestions"))
    return hints or fallback


def append_milestone(pet: Pet, *, title: str, source: str) -> None:
    items = list(pet.memory_milestones or [])
    items.append({"title": title[:40], "source": source, "at": _iso_now()})
    pet.memory_milestones = items[-20:]


async def refresh_pet_memory_summary(settings: Settings, *, pet: Pet) -> None:
    fallback = f"{pet.pet_name}最近状态稳定，继续保持规律互动。"
    instruction = (
        "你是电子宠物记忆摘要生成器。"
        "仅返回JSON对象，字段 summary 为一句中文，长度不超过40字。"
    )
    context = {
        "petName": pet.pet_name,
        "petType": pet.pet_type,
        "stats": pet.stats,
        "milestones": list(pet.memory_milestones or [])[-3:],
    }
    try:
        data = await _try_langchain_json(settings=settings, instruction=instruction, context=context)
    except Exception:
        data = None
    summary = str((data or {}).get("summary", "")).strip()[:80]
    pet.memory_summary = summary or fallback
    pet.memory_last_updated_at = datetime.now(UTC)
