"""WebSocket garden sync: joinGarden, pointer, petAction."""

from __future__ import annotations

import copy
import json
import logging
import math
import time
from collections import deque
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from cute_cat.auth.tokens import decode_ws_ticket
from cute_cat.game.cycle2 import append_diet_history, has_diet_shift_risk
from cute_cat.game.economy import get_shop_item
from cute_cat.config import get_settings
from cute_cat.game.actions import apply_action
from cute_cat.events.evaluate import build_active_events
from cute_cat.events.hooks import apply_event_hooks_after_action
from cute_cat.game.time import get_game_time, parse_anchor
from cute_cat.persistence.database import session_factory
from cute_cat.persistence.models import Pet, User
from cute_cat.realtime.garden_hub import GardenConnection, hub
from cute_cat.services.inventory import consume_inventory
from cute_cat.services.pet_state import reconcile_pet_now, snapshot_game_time

router = APIRouter()
logger = logging.getLogger(__name__)


async def _send_json(ws: WebSocket, msg: dict[str, Any]) -> None:
    await ws.send_json(msg)


def _inbound_rate_limited(buffer: deque[float], max_per_second: int) -> bool:
    now = time.monotonic()
    one_second_ago = now - 1.0
    while buffer and buffer[0] < one_second_ago:
        buffer.popleft()
    if len(buffer) >= max_per_second:
        return True
    buffer.append(now)
    return False


def _validate_inbound_message(settings, raw: Any) -> tuple[str | None, str | None, dict[str, Any] | None, str | None]:
    if not isinstance(raw, dict):
        return None, None, None, "Message must be an object"

    payload_bytes = len(json.dumps(raw, ensure_ascii=False))
    if payload_bytes > settings.ws_max_payload_bytes:
        return None, None, None, "Message payload too large"

    msg_type = raw.get("type")
    if not isinstance(msg_type, str) or not msg_type:
        return None, None, None, "Missing message type"

    request_id = raw.get("requestId")
    if request_id is not None and (not isinstance(request_id, str) or len(request_id) > settings.ws_max_request_id_len):
        return None, None, None, "Invalid requestId"

    pl = raw.get("payload")
    if pl is None:
        pl = {}
    if not isinstance(pl, dict):
        return None, request_id if isinstance(request_id, str) else None, None, "payload must be an object"

    return msg_type, request_id if isinstance(request_id, str) else None, pl, None


def _normalize_overlapped_pet_positions(pets: list[Pet]) -> None:
    """Spread pets when multiple pets share the same exact position."""
    buckets: dict[tuple[float, float], list[Pet]] = {}
    for pet in pets:
        pos = pet.position or {}
        x = float(pos.get("x", 0.5))
        y = float(pos.get("y", 0.5))
        buckets.setdefault((round(x, 4), round(y, 4)), []).append(pet)

    for (base_x, base_y), group in buckets.items():
        if len(group) <= 1:
            continue
        n = len(group)
        radius = min(0.24, 0.08 + n * 0.008)
        for idx, pet in enumerate(sorted(group, key=lambda p: p.id)):
            angle = (2 * math.pi * idx) / n
            nx = max(0.1, min(0.9, base_x + radius * math.cos(angle)))
            ny = max(0.58, min(0.88, base_y + radius * math.sin(angle)))
            pet.position = {"x": round(nx, 4), "y": round(ny, 4)}


@router.websocket("/ws/garden")
async def garden_socket(
    websocket: WebSocket,
    ticket: str = Query(...),
) -> None:
    settings = get_settings()
    try:
        payload = decode_ws_ticket(settings, ticket)
        if payload.get("typ") != "ws":
            await websocket.close(code=4401)
            return
        user_id = str(payload["sub"])
        garden_from_ticket = str(payload["gid"])
    except (JWTError, KeyError, ValueError, TypeError):
        await websocket.close(code=4401)
        return

    await websocket.accept()

    factory = session_factory(settings)
    async with factory() as session:
        user = await session.get(User, user_id)
        if user is None:
            await websocket.close(code=4401)
            return
        nickname = user.nickname

    conn = GardenConnection(user_id=user_id, nickname=nickname, garden_id=None, websocket=websocket)
    inbound_ticks: deque[float] = deque()

    try:
        while True:
            raw = await websocket.receive_json()
            if _inbound_rate_limited(inbound_ticks, settings.ws_max_messages_per_second):
                logger.warning("ws_rate_limited user_id=%s", user_id)
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "payload": {"code": "TOO_MANY_REQUESTS", "message": "WebSocket message rate exceeded"},
                    },
                )
                continue
            msg_type, request_id, pl, err = _validate_inbound_message(settings, raw)
            if err:
                logger.warning("ws_bad_message user_id=%s reason=%s", user_id, err)
                await _send_json(
                    websocket,
                    {
                        "type": "error",
                        "requestId": request_id,
                        "payload": {"code": "BAD_REQUEST", "message": err},
                    },
                )
                continue

            async with factory() as session:
                await _handle_message(
                    session,
                    settings,
                    websocket,
                    conn,
                    msg_type,
                    request_id,
                    pl,
                    user_id,
                    garden_from_ticket,
                )

    except WebSocketDisconnect:
        logger.info("ws_disconnect user_id=%s garden_id=%s", user_id, conn.garden_id)
        gid = conn.garden_id
        hub.detach(conn)
        if gid:
            others = hub.others_in_garden(gid, user_id)
            for other in others:
                await _send_json(
                    other.websocket,
                    {"type": "userLeft", "payload": {"gardenId": gid, "userId": user_id}},
                )


async def _handle_message(
    session: AsyncSession,
    settings,
    websocket: WebSocket,
    conn: GardenConnection,
    msg_type: str | None,
    request_id: str | None,
    pl: dict[str, Any],
    user_id: str,
    garden_from_ticket: str,
) -> None:
    if msg_type == "joinGarden":
        gid = str(pl.get("gardenId", ""))
        if not gid:
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "BAD_REQUEST", "message": "gardenId is required"},
                },
            )
            return
        if gid != garden_from_ticket:
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "FORBIDDEN", "message": "Ticket garden mismatch"},
                },
            )
            return

        # Lock all garden pets so joinGarden reconcile+commit cannot interleave with
        # petAction commits and overwrite newer stats (lost updates on JSON stats).
        q = await session.execute(select(Pet).where(Pet.garden_id == gid).with_for_update())
        pets = list(q.scalars().all())
        for p in pets:
            reconcile_pet_now(p, settings)
        _normalize_overlapped_pet_positions(pets)

        owner_pet_pos: dict[str, dict[str, float]] = {}
        for p in pets:
            owner_pet_pos[p.owner_user_id] = p.position or {"x": 0.5, "y": 0.5}

        users_payload: list[dict[str, Any]] = []
        for p in pets:
            u = await session.get(User, p.owner_user_id)
            if u:
                users_payload.append(
                    {
                        "userId": u.id,
                        "nickname": u.nickname,
                        "pointer": owner_pet_pos.get(u.id, {"x": 0.5, "y": 0.5}),
                    }
                )

        pets_payload: list[dict[str, Any]] = []
        for p in pets:
            pets_payload.append(
                {
                    "petId": p.id,
                    "ownerUserId": p.owner_user_id,
                    "petName": p.pet_name,
                    "petType": p.pet_type,
                    "skinSeed": p.skin_seed,
                    "position": p.position,
                    "stats": p.stats,
                    "stateVersion": p.state_version,
                }
            )

        await session.commit()

        hub.attach(gid, conn)
        logger.info("ws_join_garden user_id=%s garden_id=%s pets=%s", user_id, gid, len(pets))
        now = datetime.now(UTC)
        game_time = snapshot_game_time(settings, now)
        anchor = parse_anchor(settings.server_start_wall_clock)
        gt = get_game_time(now, anchor_wall_clock=anchor)
        active_events = await build_active_events(session, settings=settings, garden_id=gid, pets=pets, gt=gt)
        await _send_json(
            websocket,
            {
                "type": "gardenSnapshot",
                "requestId": request_id,
                "payload": {
                    "gardenId": gid,
                    "layoutVersion": 1,
                    "serverNow": now.isoformat().replace("+00:00", "Z"),
                    "gameTime": game_time,
                    "pets": pets_payload,
                    "users": users_payload,
                    "activeEvents": active_events,
                },
            },
        )
        return

    if msg_type == "updatePointer":
        gid = str(pl.get("gardenId", ""))
        if conn.garden_id != gid:
            return
        try:
            x = float(pl.get("x", 0))
            y = float(pl.get("y", 0))
        except (TypeError, ValueError):
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "BAD_REQUEST", "message": "Pointer coordinates must be numbers"},
                },
            )
            return
        if not (math.isfinite(x) and math.isfinite(y) and 0 <= x <= 1 and 0 <= y <= 1):
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "BAD_REQUEST", "message": "Pointer coordinates out of range"},
                },
            )
            return
        others = hub.others_in_garden(gid, user_id)
        for other in others:
            await _send_json(
                other.websocket,
                {
                    "type": "pointerUpdate",
                    "payload": {"gardenId": gid, "userId": user_id, "pointer": {"x": x, "y": y}},
                },
            )
        return

    if msg_type == "petAction":
        gid = str(pl.get("gardenId", ""))
        action_type = str(pl.get("actionType", ""))
        pet_id = str(pl.get("petId", ""))
        item_id = pl.get("itemId")

        if conn.garden_id != gid or gid != garden_from_ticket:
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "FORBIDDEN", "message": "Garden mismatch"},
                },
            )
            return

        # Serialize mutations per pet so concurrent petAction (e.g. two tabs) cannot
        # both read stale stats and overwrite each other's apply_action results.
        res = await session.execute(select(Pet).where(Pet.id == pet_id).with_for_update())
        pet = res.scalar_one_or_none()
        if pet is None or pet.garden_id != gid:
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "NOT_FOUND", "message": "Pet not found"},
                },
            )
            return
        if pet.owner_user_id != user_id:
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "FORBIDDEN", "message": "Not your pet"},
                },
            )
            return

        if action_type not in ("Feed", "Cuddle", "Pat"):
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "BAD_REQUEST", "message": "Unsupported action"},
                },
            )
            return

        reconcile_pet_now(pet, settings, apply_passive_decay=False)
        anchor = parse_anchor(settings.server_start_wall_clock)
        now_wall = datetime.now(UTC)
        gt = get_game_time(now_wall, anchor_wall_clock=anchor)
        try:
            food_item = None
            inventory_after_feed: int | None = None
            if action_type == "Feed":
                food_id = str(item_id or "")
                food_item = get_shop_item(food_id)
                if food_item is None or food_item.item_type != "food":
                    raise ValueError("Unsupported itemId for Feed")
                consumed = await consume_inventory(
                    session,
                    user_id=user_id,
                    item_id=food_item.item_id,
                    count=1,
                )
                if consumed is None:
                    raise ValueError("Not enough inventory for Feed")
                inventory_after_feed = int(consumed.count)
                pet.diet_history = append_diet_history(
                    pet.diet_history or [],
                    game_day_index=gt.game_day_index,
                    item_id=food_item.item_id,
                )
                flag_modified(pet, "diet_history")
                if has_diet_shift_risk(pet.diet_history, now_day_index=gt.game_day_index):
                    pet.stats["sickLevel"] = min(3, int(pet.stats["sickLevel"]) + 1)
                    pet.sick_window = [*list(pet.sick_window or [])[-3:], True]
                    flag_modified(pet, "sick_window")

            # Replace JSON column by assignment: in-place mutation of pet.stats may not persist
            # on some DB+SQLAlchemy combos, so the next petAction reads stale mood (lost updates).
            work = copy.deepcopy(pet.stats)
            for _k in list(work.keys()):
                work[_k] = int(work[_k])
            delta, anim_key = apply_action(work, action_type, item=food_item)
            pet.stats = work
            flag_modified(pet, "stats")
        except ValueError as e:
            await _send_json(
                websocket,
                {
                    "type": "error",
                    "requestId": request_id,
                    "payload": {"code": "BAD_REQUEST", "message": str(e)},
                },
            )
            return

        pet.state_version = pet.state_version + 1
        await session.flush()
        event_payloads = await apply_event_hooks_after_action(
            session,
            settings=settings,
            garden_id=gid,
            pet=pet,
            actor_user_id=user_id,
            action_type=action_type,
            gt=gt,
        )
        await session.commit()
        logger.info("ws_pet_action user_id=%s garden_id=%s pet_id=%s action=%s", user_id, gid, pet_id, action_type)

        for target in hub.all_in_garden(gid):
            await _send_json(
                target.websocket,
                {
                    "type": "actionBroadcast",
                    "payload": {
                        "gardenId": gid,
                        "actorUserId": user_id,
                        "petId": pet_id,
                        "actionType": action_type,
                        "animationKey": anim_key,
                        "occurredAtGameTime": {
                            "gameDayIndex": gt.game_day_index,
                            "gameHourFloat": round(gt.game_hour_float, 4),
                        },
                    },
                },
            )
            await _send_json(
                target.websocket,
                {
                    "type": "petStateDelta",
                    "payload": {
                        "petId": pet_id,
                        "version": pet.state_version,
                        "delta": delta,
                        "stats": pet.stats,
                    },
                },
            )
            for ev in event_payloads:
                await _send_json(
                    target.websocket,
                    {"type": "eventBroadcast", "payload": ev},
                )
            if (
                action_type == "Feed"
                and target.user_id == user_id
                and food_item is not None
                and inventory_after_feed is not None
            ):
                await _send_json(
                    target.websocket,
                    {
                        "type": "inventoryChanged",
                        "payload": {
                            "itemId": food_item.item_id,
                            "count": inventory_after_feed,
                        },
                    },
                )
        return

    await _send_json(
        websocket,
        {
            "type": "error",
            "requestId": request_id,
            "payload": {"code": "BAD_REQUEST", "message": f"Unknown type {msg_type}"},
        },
    )
