"""In-memory garden rooms (single worker; scale-out needs Redis adapter)."""

from __future__ import annotations

from dataclasses import dataclass, field

from fastapi import WebSocket


@dataclass
class GardenConnection:
    user_id: str
    nickname: str
    garden_id: str | None
    websocket: WebSocket


@dataclass
class GardenHub:
    """Maps garden_id -> connections; also user_id -> connection."""

    by_garden: dict[str, list[GardenConnection]] = field(default_factory=dict)
    by_user: dict[str, GardenConnection] = field(default_factory=dict)

    def attach(self, garden_id: str, conn: GardenConnection) -> None:
        old = self.by_user.get(conn.user_id)
        if old is not None:
            self.detach(old)
        self.by_user[conn.user_id] = conn
        self.by_garden.setdefault(garden_id, []).append(conn)
        conn.garden_id = garden_id

    def detach(self, conn: GardenConnection) -> None:
        self.by_user.pop(conn.user_id, None)
        if conn.garden_id and conn.garden_id in self.by_garden:
            self.by_garden[conn.garden_id] = [c for c in self.by_garden[conn.garden_id] if c is not conn]
            if not self.by_garden[conn.garden_id]:
                del self.by_garden[conn.garden_id]

    def others_in_garden(self, garden_id: str, exclude_user_id: str) -> list[GardenConnection]:
        return [c for c in self.by_garden.get(garden_id, []) if c.user_id != exclude_user_id]

    def all_in_garden(self, garden_id: str) -> list[GardenConnection]:
        return list(self.by_garden.get(garden_id, []))


hub = GardenHub()
