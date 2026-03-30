"""Contract phase: drop legacy relation tables

Revision ID: 009
Revises: 008
Create Date: 2026-03-26
"""

from typing import Sequence, Union
import os

from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    allow_contract = os.getenv("ALLOW_CONTRACT_DDL", "").lower() in {"1", "true", "yes"}
    if not allow_contract:
        # Keep revision chain linear in non-final environments without destructive DDL.
        return
    # Legacy relation tables replaced by profile-based schema.
    op.drop_table("parent_children")
    op.drop_table("teacher_subjects")
    op.drop_table("teacher_classes")
    op.drop_table("students")


def downgrade() -> None:
    # Re-creation of legacy tables intentionally omitted for destructive contract migration.
    raise RuntimeError("Downgrade for revision 009 is not supported.")
