"""Generate consistency and reconciliation report for relation backfill."""
from collections import Counter

from sqlalchemy import text

from app.db.session import SessionLocal
from app.models.role_profiles import (
    ClassEnrollment,
    ParentProfile,
    ParentStudentLink,
    StudentProfile,
    TeacherAssignment,
    TeacherProfile,
    UserRole,
)
from app.models.schedule import ScheduleSlot
from app.models.user import User


def main() -> None:
    db = SessionLocal()
    try:
        counts = Counter()
        counts["users"] = db.query(User).count()
        counts["user_roles"] = db.query(UserRole).count()
        counts["student_profiles"] = db.query(StudentProfile).count()
        counts["teacher_profiles"] = db.query(TeacherProfile).count()
        counts["parent_profiles"] = db.query(ParentProfile).count()
        counts["class_enrollments"] = db.query(ClassEnrollment).count()
        counts["teacher_assignments"] = db.query(TeacherAssignment).count()
        counts["parent_student_links"] = db.query(ParentStudentLink).count()
        counts["schedule_slots_missing_teacher_id"] = db.query(ScheduleSlot).filter(
            ScheduleSlot.teacher_id.is_(None),
            ScheduleSlot.teacher_name.isnot(None),
            ScheduleSlot.teacher_name != "",
        ).count()
        counts["teacher_mapping_conflicts"] = _safe_scalar_count(
            db,
            "select count(*) from teacher_mapping_conflicts",
        )
        counts["mismatch_users_role_vs_user_roles"] = _safe_scalar_count(
            db,
            """
            select count(*)
            from users u
            where u.role is not null
              and not exists (
                select 1
                from user_roles ur
                where ur.user_id = u.id and ur.role = u.role
              )
            """,
        )
        counts["mismatch_users_class_vs_enrollments"] = _safe_scalar_count(
            db,
            """
            select count(*)
            from users u
            where u.role = 'student'
              and u.class_id is not null
              and not exists (
                select 1
                from class_enrollments ce
                where ce.student_user_id = u.id and ce.class_id = u.class_id
              )
            """,
        )

        print("=== Relation Backfill Report ===")
        for key in sorted(counts):
            print(f"{key}: {counts[key]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()


def _safe_scalar_count(db, query: str) -> int:
    try:
        return int(db.execute(text(query)).scalar() or 0)
    except Exception:
        # Legacy tables may be absent after contract migration; keep report usable.
        return -1
