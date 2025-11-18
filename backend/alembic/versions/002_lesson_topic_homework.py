"""Add topic and homework_text to lessons

Revision ID: 002
Revises: 001
Create Date: 2025-02-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lessons", sa.Column("topic", sa.String(500), nullable=True))
    op.add_column("lessons", sa.Column("homework_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lessons", "homework_text")
    op.drop_column("lessons", "topic")
