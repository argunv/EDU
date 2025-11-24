"""Add index on grades (student_id, subject_id, date) for journal queries

Revision ID: 006
Revises: 005
Create Date: 2025-03

"""
from typing import Sequence, Union

from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_grades_student_subject_date",
        "grades",
        ["student_id", "subject_id", "date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_grades_student_subject_date", table_name="grades")
