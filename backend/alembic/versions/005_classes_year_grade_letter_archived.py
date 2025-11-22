"""Add year_start, grade, letter, archived to classes

Revision ID: 005
Revises: 004
Create Date: 2025-02-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _current_school_year_from_connection(conn) -> int:
    """Учебный год: если месяц >= 9, то текущий год, иначе текущий - 1."""
    from datetime import datetime
    now = datetime.utcnow()
    return now.year if now.month >= 9 else now.year - 1


def upgrade() -> None:
    op.add_column("classes", sa.Column("year_start", sa.Integer(), nullable=True))
    op.add_column("classes", sa.Column("grade", sa.Integer(), nullable=True))
    op.add_column("classes", sa.Column("letter", sa.String(5), nullable=True))
    op.add_column(
        "classes",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    conn = op.get_bind()
    default_year = _current_school_year_from_connection(conn)
    rows = conn.execute(text("SELECT id, name FROM classes")).fetchall()
    for (pk, name) in rows:
        grade_val = None
        letter_val = None
        if name:
            import re
            m = re.match(r"^(\d{1,2})([А-Яа-яA-Za-z]+)$", name.strip())
            if m:
                grade_val = int(m.group(1))
                letter_val = m.group(2).strip()[:5] or "А"
        if grade_val is None:
            grade_val = 1
        if letter_val is None or not letter_val:
            letter_val = "А"
        conn.execute(
            text(
                "UPDATE classes SET year_start = :y, grade = :g, letter = :l WHERE id = :id"
            ),
            {"y": default_year, "g": grade_val, "l": letter_val, "id": pk},
        )

    op.alter_column(
        "classes",
        "year_start",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "classes",
        "grade",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "classes",
        "letter",
        existing_type=sa.String(5),
        nullable=False,
    )

    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        conn.execute(text("ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_name_key"))
        conn.execute(text("DROP INDEX IF EXISTS ix_classes_name"))

    op.create_unique_constraint(
        "uq_classes_year_grade_letter",
        "classes",
        ["year_start", "grade", "letter"],
    )
    op.create_index("ix_classes_archived", "classes", ["archived"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_classes_archived", table_name="classes")
    op.drop_constraint("uq_classes_year_grade_letter", "classes", type_="unique")
    op.drop_column("classes", "archived")
    op.drop_column("classes", "letter")
    op.drop_column("classes", "grade")
    op.drop_column("classes", "year_start")
