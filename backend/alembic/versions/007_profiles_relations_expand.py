"""Expand schema for profile-based relations

Revision ID: 007
Revises: 006
Create Date: 2026-03-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role in ('admin','teacher','student','parent','pending','rejected')", name="ck_user_roles_role"),
    )
    op.create_unique_constraint("uq_user_role", "user_roles", ["user_id", "role"])

    op.create_table(
        "student_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
    )
    op.create_table(
        "teacher_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
    )
    op.create_table(
        "parent_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
    )

    op.create_table(
        "class_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
    )
    op.create_unique_constraint("uq_class_enrollment_period", "class_enrollments", ["student_user_id", "class_id", "start_date"])

    op.create_table(
        "teacher_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("teacher_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("class_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("classes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_unique_constraint("uq_teacher_assignment", "teacher_assignments", ["teacher_user_id", "class_id", "subject_id"])

    op.create_table(
        "parent_student_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("parent_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
    )
    op.create_unique_constraint("uq_parent_student_link", "parent_student_links", ["parent_user_id", "student_user_id"])

    op.add_column("schedule_slots", sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_schedule_slots_teacher_id_users", "schedule_slots", "users", ["teacher_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_schedule_slots_teacher_id", "schedule_slots", ["teacher_id"], unique=False)
    op.create_index("ix_schedule_slots_class_shift_day_lesson", "schedule_slots", ["class_id", "shift", "day_label", "lesson_number"], unique=False)

    op.add_column("lessons", sa.Column("teacher_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_lessons_teacher_id_users", "lessons", "users", ["teacher_id"], ["id"], ondelete="SET NULL")
    op.create_unique_constraint("uq_lesson_slot", "lessons", ["class_id", "subject_id", "date", "time"])
    op.create_index("ix_lessons_class_date", "lessons", ["class_id", "date"], unique=False)

    op.create_check_constraint("ck_grades_value", "grades", "(value is null) or (value in ('2','3','4','5','Н'))")
    op.create_check_constraint("ck_lesson_attendance_value", "lesson_attendances", "attendance in ('present','absent')")
    op.create_unique_constraint("uq_lesson_attendance_student", "lesson_attendances", ["lesson_id", "student_id"])


def downgrade() -> None:
    op.drop_constraint("ck_lesson_attendance_value", "lesson_attendances", type_="check")
    op.drop_constraint("uq_lesson_attendance_student", "lesson_attendances", type_="unique")
    op.drop_constraint("ck_grades_value", "grades", type_="check")
    op.drop_index("ix_lessons_class_date", table_name="lessons")
    op.drop_constraint("uq_lesson_slot", "lessons", type_="unique")
    op.drop_constraint("fk_lessons_teacher_id_users", "lessons", type_="foreignkey")
    op.drop_column("lessons", "teacher_id")
    op.drop_index("ix_schedule_slots_class_shift_day_lesson", table_name="schedule_slots")
    op.drop_index("ix_schedule_slots_teacher_id", table_name="schedule_slots")
    op.drop_constraint("fk_schedule_slots_teacher_id_users", "schedule_slots", type_="foreignkey")
    op.drop_column("schedule_slots", "teacher_id")

    op.drop_constraint("uq_parent_student_link", "parent_student_links", type_="unique")
    op.drop_table("parent_student_links")
    op.drop_constraint("uq_teacher_assignment", "teacher_assignments", type_="unique")
    op.drop_table("teacher_assignments")
    op.drop_constraint("uq_class_enrollment_period", "class_enrollments", type_="unique")
    op.drop_table("class_enrollments")
    op.drop_table("parent_profiles")
    op.drop_table("teacher_profiles")
    op.drop_table("student_profiles")
    op.drop_constraint("uq_user_role", "user_roles", type_="unique")
    op.drop_table("user_roles")
