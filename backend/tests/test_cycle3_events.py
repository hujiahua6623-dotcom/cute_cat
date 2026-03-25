from __future__ import annotations

from fastapi.testclient import TestClient

from cute_cat.events.rules import is_birthday_anniversary_day, social_window_bounds
def test_cycle3_birthday_anniversary_modulo() -> None:
    assert is_birthday_anniversary_day(100, 100)
    assert not is_birthday_anniversary_day(99, 100)
    assert is_birthday_anniversary_day(465, 100)


def test_cycle3_social_window_deterministic() -> None:
    gid = "gdn_shared_mvp_01"
    in_w, start = social_window_bounds(0, gid)
    assert isinstance(in_w, bool)
    if in_w:
        assert start is not None
        assert 0 <= (0 - start) < 2


def test_cycle3_join_snapshot_has_active_events_and_birthday(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, pet_id, garden_id = _register_and_claim(c, "cycle3_evt@b.com")

    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"

    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-1", "payload": {"gardenId": garden_id}})
        snap = _ws_recv_until(ws, "gardenSnapshot")
        pl = snap["payload"]
        assert "activeEvents" in pl
        assert isinstance(pl["activeEvents"], list)
        bdays = [e for e in pl["activeEvents"] if e.get("eventType") == "birthday"]
        assert len(bdays) == 1
        assert bdays[0]["petId"] == pet_id
        assert bdays[0]["ownerUserId"]


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
