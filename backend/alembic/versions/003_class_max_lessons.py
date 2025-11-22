"""Add max_lessons_per_week to classes

Revision ID: 004
Revises: 003
Create Date: 2025-02-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "classes",
        sa.Column("max_lessons_per_week", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("classes", "max_lessons_per_week")
