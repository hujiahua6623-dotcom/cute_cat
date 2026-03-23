"""cycle 2 core schema

Revision ID: 002_cycle2_core_schema
Revises: 001_initial
Create Date: 2026-03-24

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_cycle2_core_schema"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pets", sa.Column("diet_history", sa.JSON(), nullable=True))
    op.execute("UPDATE pets SET diet_history = JSON_ARRAY() WHERE diet_history IS NULL")
    op.alter_column("pets", "diet_history", existing_type=sa.JSON(), nullable=False)
    op.add_column(
        "pets",
        sa.Column("last_game_day_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "pets",
        sa.Column("consecutive_stable_days", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "inventories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("item_id", sa.String(length=64), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("user_id", "item_id", name="uq_inventories_user_item"),
    )
    op.create_index("ix_inventories_user_id", "inventories", ["user_id"])
    op.create_index("ix_inventories_item_id", "inventories", ["item_id"])


def downgrade() -> None:
    op.drop_table("inventories")
    op.drop_column("pets", "consecutive_stable_days")
    op.drop_column("pets", "last_game_day_index")
    op.drop_column("pets", "diet_history")
