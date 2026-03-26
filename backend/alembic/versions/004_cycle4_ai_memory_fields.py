"""cycle 4 ai memory fields

Revision ID: 004_cycle4_ai_memory_fields
Revises: 003_garden_event_progress
Create Date: 2026-03-26
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_cycle4_ai_memory_fields"
down_revision: Union[str, None] = "003_garden_event_progress"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pets",
        sa.Column("memory_summary", sa.String(length=512), nullable=False, server_default=""),
    )
    op.add_column("pets", sa.Column("memory_milestones", sa.JSON(), nullable=True))
    op.execute("UPDATE pets SET memory_milestones = JSON_ARRAY() WHERE memory_milestones IS NULL")
    op.alter_column("pets", "memory_milestones", existing_type=sa.JSON(), nullable=False)
    op.add_column(
        "pets",
        sa.Column("memory_last_updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pets", "memory_last_updated_at")
    op.drop_column("pets", "memory_milestones")
    op.drop_column("pets", "memory_summary")
