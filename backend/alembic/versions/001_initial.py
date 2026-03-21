"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-03-21

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("nickname", sa.String(length=64), nullable=False),
        sa.Column("coins", sa.Integer(), nullable=False, server_default="100"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "gardens",
        sa.Column("id", sa.String(length=36), primary_key=True),
    )

    op.create_table(
        "pets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("garden_id", sa.String(length=36), sa.ForeignKey("gardens.id"), nullable=False),
        sa.Column("pet_name", sa.String(length=64), nullable=False),
        sa.Column("pet_type", sa.String(length=32), nullable=False),
        sa.Column("skin_seed", sa.Integer(), nullable=False),
        sa.Column("growth_stage", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("birthday_game_day", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("stats", sa.JSON(), nullable=False),
        sa.Column("position", sa.JSON(), nullable=False),
        sa.Column("sick_window", sa.JSON(), nullable=False),
        sa.Column("state_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_seen_wall_clock", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_pets_owner_user_id", "pets", ["owner_user_id"])
    op.create_index("ix_pets_garden_id", "pets", ["garden_id"])

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.drop_table("pets")
    op.drop_table("gardens")
    op.drop_table("users")
