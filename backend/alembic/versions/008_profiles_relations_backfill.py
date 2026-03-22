"""Backfill profile-based relations from legacy tables

Revision ID: 008
Revises: 007
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS teacher_mapping_conflicts (
                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                schedule_slot_id uuid REFERENCES schedule_slots(id) ON DELETE CASCADE,
                teacher_name text NOT NULL,
                reason text NOT NULL,
                created_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )
    )
    conn.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_mapping_conflict_slot
            ON teacher_mapping_conflicts(schedule_slot_id)
            """
        )
    )

    conn.execute(
        text(
            """
            INSERT INTO user_roles (id, user_id, role, created_at)
            SELECT gen_random_uuid(), u.id, u.role, COALESCE(u.created_at, now())
            FROM users u
            WHERE u.role IS NOT NULL
            ON CONFLICT (user_id, role) DO NOTHING
            """
        )
    )

    conn.execute(
        text(
            """
            INSERT INTO student_profiles (id, user_id)
            SELECT gen_random_uuid(), u.id FROM users u
            WHERE u.role = 'student'
            ON CONFLICT (user_id) DO NOTHING
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO teacher_profiles (id, user_id)
            SELECT gen_random_uuid(), u.id FROM users u
            WHERE u.role = 'teacher'
            ON CONFLICT (user_id) DO NOTHING
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO parent_profiles (id, user_id)
            SELECT gen_random_uuid(), u.id FROM users u
            WHERE u.role = 'parent'
            ON CONFLICT (user_id) DO NOTHING
            """
        )
    )

    conn.execute(
        text(
            """
            INSERT INTO class_enrollments (id, student_user_id, class_id, start_date, end_date)
            SELECT gen_random_uuid(), u.id, u.class_id, CURRENT_DATE, NULL
            FROM users u
            WHERE u.role = 'student' AND u.class_id IS NOT NULL
            ON CONFLICT (student_user_id, class_id, start_date) DO NOTHING
            """
        )
    )

    conn.execute(
        text(
            """
            INSERT INTO teacher_assignments (id, teacher_user_id, class_id, subject_id)
            SELECT gen_random_uuid(), tc.teacher_id, tc.class_id, ts.subject_id
            FROM teacher_classes tc
            JOIN teacher_subjects ts ON ts.teacher_id = tc.teacher_id
            ON CONFLICT (teacher_user_id, class_id, subject_id) DO NOTHING
            """
        )
    )

    conn.execute(
        text(
            """
            INSERT INTO parent_student_links (id, parent_user_id, student_user_id)
            SELECT gen_random_uuid(), pc.parent_id, pc.child_id
            FROM parent_children pc
            ON CONFLICT (parent_user_id, student_user_id) DO NOTHING
            """
        )
    )

    # Best-effort teacher_id backfill by exact teacher_name match
    conn.execute(
        text(
            """
            UPDATE schedule_slots ss
            SET teacher_id = u.id
            FROM users u
            WHERE ss.teacher_id IS NULL
              AND u.role = 'teacher'
              AND u.name = ss.teacher_name
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO teacher_mapping_conflicts (schedule_slot_id, teacher_name, reason)
            SELECT ss.id, ss.teacher_name, 'NO_EXACT_TEACHER_MATCH'
            FROM schedule_slots ss
            WHERE ss.teacher_id IS NULL
              AND ss.teacher_name IS NOT NULL
              AND btrim(ss.teacher_name) <> ''
            ON CONFLICT (schedule_slot_id) DO NOTHING
            """
        )
    )

    conn.execute(
        text(
            """
            UPDATE lessons l
            SET teacher_id = ss.teacher_id
            FROM schedule_slots ss
            WHERE l.teacher_id IS NULL
              AND ss.class_id = l.class_id
              AND ss.subject_id = l.subject_id
              AND ss.time = l.time
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP TABLE IF EXISTS teacher_mapping_conflicts"))
    conn.execute(text("DELETE FROM parent_student_links"))
    conn.execute(text("DELETE FROM teacher_assignments"))
    conn.execute(text("DELETE FROM class_enrollments"))
    conn.execute(text("DELETE FROM parent_profiles"))
    conn.execute(text("DELETE FROM teacher_profiles"))
    conn.execute(text("DELETE FROM student_profiles"))
    conn.execute(text("DELETE FROM user_roles"))
