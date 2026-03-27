from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient
import pytest

from cute_cat.game.actions import apply_action
from cute_cat.game.cycle2 import has_diet_shift_risk, rollup_growth_days
from cute_cat.game.economy import get_shop_item
from cute_cat.persistence.models import Pet
from cute_cat.services.inventory import add_inventory, consume_inventory, get_inventory


def _register_and_claim(c: TestClient, email: str) -> tuple[dict[str, str], str, str]:
    r = c.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "password12", "nickname": "n"},
    )
    assert r.status_code == 201, r.text
    token = r.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}

    rc = c.post(
        "/api/v1/pets/claim",
        headers=headers,
        json={"petName": "m", "petType": "cat"},
    )
    assert rc.status_code == 201, rc.text
    claim = rc.json()
    return headers, claim["petId"], claim["gardenId"]


def _ws_recv_until(ws, expected_type: str, max_steps: int = 10) -> dict:
    for _ in range(max_steps):
        msg = ws.receive_json()
        if msg.get("type") == expected_type:
            return msg
    raise AssertionError(f"Did not receive expected ws type: {expected_type}")


def test_cycle2_shop_inventory_and_feed_require_item(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, _, _ = _register_and_claim(c, "cycle2_a@b.com")
    coins_before = c.get("/api/v1/me", headers=headers).json()["coins"]

    r_bad = c.post("/api/v1/shop/buy", headers=headers, json={"itemId": "unknown_item", "count": 1})
    assert r_bad.status_code == 400
    assert r_bad.json()["error"]["code"] == "BAD_REQUEST"

    r_buy = c.post("/api/v1/shop/buy", headers=headers, json={"itemId": "food_basic_01", "count": 2})
    assert r_buy.status_code == 200, r_buy.text
    item = get_shop_item("food_basic_01")
    assert item is not None
    assert r_buy.json()["coinsAfter"] == coins_before - item.price_coins * 2
    r_inv = c.get("/api/v1/shop/inventory", headers=headers)
    assert r_inv.status_code == 200, r_inv.text
    items = r_inv.json()["items"]
    assert any(it["itemId"] == "food_basic_01" and int(it["count"]) == 2 for it in items)

    stats = {"hunger": 80, "health": 50, "mood": 50, "loyalty": 40, "sickLevel": 0}
    delta, _ = apply_action(stats, "Feed", item=item)
    assert delta["hunger"] < 0
    with pytest.raises(ValueError):
        apply_action(stats, "Feed", item=None)


def test_cycle2_ws_feed_consumes_inventory_and_errors_when_empty(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, pet_id, garden_id = _register_and_claim(c, "cycle2_ws@b.com")
    buy = c.post("/api/v1/shop/buy", headers=headers, json={"itemId": "food_basic_01", "count": 1})
    assert buy.status_code == 200, buy.text

    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"

    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-1", "payload": {"gardenId": garden_id}})
        snap = _ws_recv_until(ws, "gardenSnapshot")
        assert snap["payload"]["gardenId"] == garden_id

        ws.send_json(
            {
                "type": "petAction",
                "requestId": "feed-1",
                "payload": {
                    "gardenId": garden_id,
                    "petId": pet_id,
                    "actionType": "Feed",
                    "itemId": "food_basic_01",
                },
            }
        )
        delta = _ws_recv_until(ws, "petStateDelta")
        assert delta["payload"]["petId"] == pet_id

        ws.send_json(
            {
                "type": "petAction",
                "requestId": "feed-2",
                "payload": {
                    "gardenId": garden_id,
                    "petId": pet_id,
                    "actionType": "Feed",
                    "itemId": "food_basic_01",
                },
            }
        )
        err = _ws_recv_until(ws, "error")
        assert err["payload"]["code"] == "BAD_REQUEST"
        assert "inventory" in err["payload"]["message"].lower()


def test_cycle2_ws_update_pointer_rejects_invalid_coordinates(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, _, garden_id = _register_and_claim(c, "cycle2_ptr_invalid@b.com")
    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"

    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-invalid", "payload": {"gardenId": garden_id}})
        _ws_recv_until(ws, "gardenSnapshot")
        ws.send_json(
            {
                "type": "updatePointer",
                "requestId": "ptr-invalid",
                "payload": {"gardenId": garden_id, "x": "bad", "y": 0.2},
            }
        )
        err = _ws_recv_until(ws, "error")
        assert err["payload"]["code"] == "BAD_REQUEST"
        assert "coordinates" in err["payload"]["message"].lower()


def test_cycle2_ws_rate_limit_returns_too_many_requests(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, _, garden_id = _register_and_claim(c, "cycle2_rate@b.com")
    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"

    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-rate", "payload": {"gardenId": garden_id}})
        _ws_recv_until(ws, "gardenSnapshot")

        for i in range(80):
            ws.send_json(
                {
                    "type": "unknownTypeForLimit",
                    "requestId": f"limit-{i}",
                    "payload": {"gardenId": garden_id},
                }
            )

        got_limit = False
        for _ in range(120):
            msg = ws.receive_json()
            if msg.get("type") == "error" and msg.get("payload", {}).get("code") == "TOO_MANY_REQUESTS":
                got_limit = True
                break
        assert got_limit


def test_cycle2_join_snapshot_spreads_overlapped_pet_positions(client_with_db: TestClient) -> None:
    c = client_with_db
    headers_a, _, garden_id = _register_and_claim(c, "cycle2_pos_a@b.com")
    _register_and_claim(c, "cycle2_pos_b@b.com")

    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers_a)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"
    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-pos", "payload": {"gardenId": garden_id}})
        snap = _ws_recv_until(ws, "gardenSnapshot")
        pets = snap["payload"]["pets"]
        assert len(pets) >= 2
        coords = {(round(float(p["position"]["x"]), 4), round(float(p["position"]["y"]), 4)) for p in pets}
        assert len(coords) > 1


def test_cycle2_diet_shift_and_hospital_treat(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, pet_id, _ = _register_and_claim(c, "cycle2_b@b.com")
    coins_before = c.get("/api/v1/me", headers=headers).json()["coins"]

    diet_history = [
        {"gameDayIndex": 10, "itemId": "food_basic_01"},
        {"gameDayIndex": 10, "itemId": "food_fancy_01"},
        {"gameDayIndex": 11, "itemId": "food_basic_01"},
    ]
    assert has_diet_shift_risk(diet_history, now_day_index=11)

    factory = getattr(c, "_session_factory")

    async def _mark_pet_sick():
        async with factory() as s:
            pet = await s.get(Pet, pet_id)
            assert pet is not None
            pet.stats = {**pet.stats, "sickLevel": 2}
            await s.commit()

    asyncio.run(_mark_pet_sick())

    rh = c.post("/api/v1/hospital/treat", headers=headers, json={"petId": pet_id})
    assert rh.status_code == 200, rh.text
    data = rh.json()
    assert data["petId"] == pet_id
    assert int(data["stats"]["sickLevel"]) <= 0
    assert data["coinsAfter"] == coins_before - 30


def test_cycle2_inventory_consume_service(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, _, _ = _register_and_claim(c, "cycle2_c@b.com")
    me = c.get("/api/v1/me", headers=headers).json()
    user_id = me["userId"]
    factory = getattr(c, "_session_factory")

    async def _run():
        async with factory() as s:
            await add_inventory(s, user_id=user_id, item_id="food_basic_01", count=2)
            await s.commit()
            ok = await consume_inventory(s, user_id=user_id, item_id="food_basic_01", count=1)
            assert ok is not None
            await s.commit()
            left = await get_inventory(s, user_id=user_id, item_id="food_basic_01")
            assert left is not None
            assert left.count == 1
            fail = await consume_inventory(s, user_id=user_id, item_id="food_basic_01", count=2)
            assert fail is None

    asyncio.run(_run())


def test_cycle2_growth_window_rule() -> None:
    stats = {"health": 90, "mood": 90, "sickLevel": 0}
    window, consecutive, stage, last_day = rollup_growth_days(
        stats=stats,
        sick_window=[],
        growth_stage=0,
        consecutive_stable_days=0,
        last_game_day_index=0,
        now_game_day_index=4,
    )
    assert window == [False, False, False, False]
    assert stage == 2
    assert consecutive == 0
    assert last_day == 4

    # Binary sick_count in the last-4-day window should block day success while any True exists.
    window2, consecutive2, stage2, _ = rollup_growth_days(
        stats=stats,
        sick_window=[False, False, False, True],
        growth_stage=stage,
        consecutive_stable_days=0,
        last_game_day_index=4,
        now_game_day_index=5,
    )
    assert any(window2)
    assert stage2 == stage
    assert consecutive2 == 0


def test_ws_pat_then_cuddle_delta_magnitudes(client_with_db: TestClient) -> None:
    """Sanity-check apply_action mood deltas over WebSocket (Pat +6, Cuddle +10)."""
    c = client_with_db
    headers, pet_id, garden_id = _register_and_claim(c, "pat_cuddle@b.com")
    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"

    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-1", "payload": {"gardenId": garden_id}})
        _ws_recv_until(ws, "gardenSnapshot")

        ws.send_json(
            {
                "type": "petAction",
                "requestId": "pat-1",
                "payload": {"gardenId": garden_id, "petId": pet_id, "actionType": "Pat"},
            }
        )
        d1 = _ws_recv_until(ws, "petStateDelta")
        assert d1["payload"]["petId"] == pet_id
        assert int(d1["payload"]["delta"]["mood"]) == 6

        ws.send_json(
            {
                "type": "petAction",
                "requestId": "cuddle-1",
                "payload": {"gardenId": garden_id, "petId": pet_id, "actionType": "Cuddle"},
            }
        )
        d2 = _ws_recv_until(ws, "petStateDelta")
        assert d2["payload"]["petId"] == pet_id
        assert int(d2["payload"]["delta"]["mood"]) == 10
