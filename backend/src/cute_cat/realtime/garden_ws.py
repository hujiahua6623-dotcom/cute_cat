"""WebSocket garden sync: joinGarden, pointer, petAction."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from cute_cat.auth.tokens import decode_ws_ticket
from cute_cat.config import get_settings
from cute_cat.game.actions import apply_action
from cute_cat.game.time import get_game_time, parse_anchor
from cute_cat.persistence.database import session_factory
from cute_cat.persistence.models import Pet, User
from cute_cat.realtime.garden_hub import GardenConnection, hub
from cute_cat.services.pet_state import reconcile_pet_now, snapshot_game_time

router = APIRouter()


async def _send_json(ws: WebSocket, msg: dict[str, Any]) -> None:
    await ws.send_json(msg)


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

    try:
        while True:
            raw = await websocket.receive_json()
            msg_type = raw.get("type")
            request_id = raw.get("requestId")
            pl = raw.get("payload") or {}

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

        q = await session.execute(select(Pet).where(Pet.garden_id == gid))
        pets = list(q.scalars().all())
        for p in pets:
            reconcile_pet_now(p, settings)

        users_payload: list[dict[str, Any]] = []
        for p in pets:
            u = await session.get(User, p.owner_user_id)
            if u:
                users_payload.append(
                    {"userId": u.id, "nickname": u.nickname, "pointer": {"x": 0.5, "y": 0.5}}
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
                }
            )

        await session.commit()

        hub.attach(gid, conn)
        now = datetime.now(UTC)
        game_time = snapshot_game_time(settings, now)
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
                },
            },
        )
        return

    if msg_type == "updatePointer":
        gid = str(pl.get("gardenId", ""))
        if conn.garden_id != gid:
            return
        x = float(pl.get("x", 0))
        y = float(pl.get("y", 0))
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

        pet = await session.get(Pet, pet_id)
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

        reconcile_pet_now(pet, settings)
        try:
            delta, anim_key = apply_action(pet.stats, action_type, item_id=item_id)
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
        await session.commit()

        anchor = parse_anchor(settings.server_start_wall_clock)
        gt = get_game_time(datetime.now(UTC), anchor_wall_clock=anchor)

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
        return

    await _send_json(
        websocket,
        {
            "type": "error",
            "requestId": request_id,
            "payload": {"code": "BAD_REQUEST", "message": f"Unknown type {msg_type}"},
        },
    )
