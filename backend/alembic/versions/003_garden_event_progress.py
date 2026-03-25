"""garden event progress for cycle 3

Revision ID: 003_garden_event_progress
Revises: 002_cycle2_core_schema
Create Date: 2026-03-25

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_garden_event_progress"
down_revision: Union[str, None] = "002_cycle2_core_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "garden_event_progress",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("garden_id", sa.String(length=36), sa.ForeignKey("gardens.id"), nullable=False),
        sa.Column("anchor_key", sa.String(length=160), nullable=False),
        sa.Column("event_kind", sa.String(length=32), nullable=False),
        sa.Column("pet_id", sa.String(length=36), sa.ForeignKey("pets.id"), nullable=True),
        sa.Column("progress", sa.JSON(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default="0"),
        sa.UniqueConstraint("garden_id", "anchor_key", name="uq_garden_event_progress_garden_anchor"),
    )
    op.create_index("ix_garden_event_progress_garden_id", "garden_event_progress", ["garden_id"])


def downgrade() -> None:
    op.drop_index("ix_garden_event_progress_garden_id", table_name="garden_event_progress")
    op.drop_table("garden_event_progress")
