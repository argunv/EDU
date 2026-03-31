"""Hardening constraints for profile-based relations

Revision ID: 010
Revises: 009
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Deduplicate grades for (student, subject, date): keep latest by id.
    conn.execute(
        text(
            """
            WITH ranked AS (
              SELECT id,
                     ROW_NUMBER() OVER (
                       PARTITION BY student_id, subject_id, date
                       ORDER BY id DESC
                     ) AS rn
              FROM grades
              WHERE subject_id IS NOT NULL
            )
            DELETE FROM grades g
            USING ranked r
            WHERE g.id = r.id
              AND r.rn > 1
            """
        )
    )

    op.create_index(
        "uq_grades_student_subject_date",
        "grades",
        ["student_id", "subject_id", "date"],
        unique=True,
        postgresql_where=text("subject_id IS NOT NULL"),
    )

    op.create_check_constraint(
        "ck_class_enrollments_period_valid",
        "class_enrollments",
        "end_date IS NULL OR end_date >= start_date",
    )

    # Protect from overlapping enrollment periods per student.
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
    conn.execute(
        text(
            """
            ALTER TABLE class_enrollments
            ADD CONSTRAINT ex_class_enrollments_no_overlap
            EXCLUDE USING gist (
              student_user_id WITH =,
              daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
            )
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("ALTER TABLE class_enrollments DROP CONSTRAINT IF EXISTS ex_class_enrollments_no_overlap"))
    op.drop_constraint("ck_class_enrollments_period_valid", "class_enrollments", type_="check")
    op.drop_index("uq_grades_student_subject_date", table_name="grades")
