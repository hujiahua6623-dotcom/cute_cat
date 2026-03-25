from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str] = mapped_column(String(64))
    coins: Mapped[int] = mapped_column(Integer, default=100, server_default="100")

    pet: Mapped[Pet | None] = relationship(back_populates="owner", uselist=False)


class Garden(Base):
    __tablename__ = "gardens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)


class Pet(Base):
    __tablename__ = "pets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    garden_id: Mapped[str] = mapped_column(String(36), ForeignKey("gardens.id"), index=True)

    pet_name: Mapped[str] = mapped_column(String(64))
    pet_type: Mapped[str] = mapped_column(String(32))
    skin_seed: Mapped[int] = mapped_column(Integer)
    growth_stage: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    birthday_game_day: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # JSON: hunger, health, mood, loyalty, sick_level
    stats: Mapped[dict] = mapped_column(JSON)
    # JSON position {x,y} normalized 0-1
    position: Mapped[dict] = mapped_column(JSON)

    # Sliding window sick flags for stability (simplified period-1: last 4 days booleans)
    sick_window: Mapped[list] = mapped_column(JSON, default=list)
    # Recent feed actions for diet-shift checks (cycle 2)
    diet_history: Mapped[list] = mapped_column(JSON, default=list)
    # Last day index processed by growth/day rollup
    last_game_day_index: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Consecutive days satisfying growth stability rule
    consecutive_stable_days: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    state_version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    last_seen_wall_clock: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    owner: Mapped[User] = relationship(back_populates="pet", foreign_keys=[owner_user_id])


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class GardenEventProgress(Base):
    """Per-garden event instance progress (cycle 3)."""

    __tablename__ = "garden_event_progress"
    __table_args__ = (UniqueConstraint("garden_id", "anchor_key", name="uq_garden_event_progress_garden_anchor"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    garden_id: Mapped[str] = mapped_column(String(36), ForeignKey("gardens.id"), index=True)
    anchor_key: Mapped[str] = mapped_column(String(160))
    event_kind: Mapped[str] = mapped_column(String(32))
    pet_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("pets.id"), nullable=True)
    progress: Mapped[dict] = mapped_column(JSON, default=dict)
    completed: Mapped[bool] = mapped_column(default=False, server_default="0")


class Inventory(Base):
    __tablename__ = "inventories"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_inventories_user_item"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    item_id: Mapped[str] = mapped_column(String(64), index=True)
    count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
