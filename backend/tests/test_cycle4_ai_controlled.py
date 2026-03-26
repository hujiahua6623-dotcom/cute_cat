from __future__ import annotations

import asyncio

from fastapi.testclient import TestClient

from cute_cat.persistence.models import Pet


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
        json={"petName": "mimi", "petType": "cat"},
    )
    assert rc.status_code == 201, rc.text
    claim = rc.json()
    return headers, claim["petId"], claim["gardenId"]


def _ws_recv_until(ws, expected_type: str, max_steps: int = 12) -> dict:
    for _ in range(max_steps):
        msg = ws.receive_json()
        if msg.get("type") == expected_type:
            return msg
    raise AssertionError(f"Did not receive expected ws type: {expected_type}")


def test_cycle4_pet_snapshot_contains_memory_fields(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, pet_id, _ = _register_and_claim(c, "cycle4_mem@b.com")
    rp = c.get(f"/api/v1/pets/{pet_id}", headers=headers)
    assert rp.status_code == 200, rp.text
    memory = rp.json()["memory"]
    assert "summary" in memory
    assert "milestones" in memory
    assert "lastUpdatedAt" in memory
    assert isinstance(memory["milestones"], list)


def test_cycle4_hospital_treat_returns_suggestions_and_updates_memory(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, pet_id, _ = _register_and_claim(c, "cycle4_treat@b.com")
    factory = getattr(c, "_session_factory")

    async def _mark_pet_sick():
        async with factory() as s:
            pet = await s.get(Pet, pet_id)
            assert pet is not None
            pet.stats = {**pet.stats, "sickLevel": 2}
            await s.commit()

    asyncio.run(_mark_pet_sick())
    rt = c.post("/api/v1/hospital/treat", headers=headers, json={"petId": pet_id})
    assert rt.status_code == 200, rt.text
    data = rt.json()
    assert isinstance(data.get("narrativeSuggestions"), list)
    assert len(data["narrativeSuggestions"]) >= 1

    rp = c.get(f"/api/v1/pets/{pet_id}", headers=headers)
    assert rp.status_code == 200, rp.text
    memory = rp.json()["memory"]
    assert memory["summary"] != ""
    assert len(memory["milestones"]) >= 1


def test_cycle4_event_payload_contains_narrative_suggestions(client_with_db: TestClient) -> None:
    c = client_with_db
    headers, _, garden_id = _register_and_claim(c, "cycle4_evt@b.com")
    rt = c.get("/api/v1/gardens/ws-ticket", headers=headers)
    assert rt.status_code == 200, rt.text
    ws_url = f"/api/v1/ws/garden?ticket={rt.json()['ticket']}"
    with c.websocket_connect(ws_url) as ws:
        ws.send_json({"type": "joinGarden", "requestId": "join-1", "payload": {"gardenId": garden_id}})
        snap = _ws_recv_until(ws, "gardenSnapshot")
        events = snap["payload"]["activeEvents"]
        assert isinstance(events, list)
        assert any(isinstance(ev.get("narrativeSuggestions"), list) for ev in events)
