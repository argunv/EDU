from sqlalchemy.orm import Session

from app.core.timeutil import now
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.user import User
from app.models.role_profiles import (
    ClassEnrollment,
    ParentStudentLink,
    TeacherAssignment,
)
from app.schemas.profile import (
    ProfileAssignmentItem,
    ProfileChildItem,
    ProfileResponse,
)
from app.services.relation_access import get_active_enrollment, get_parent_child_ids
from app.services.avatar_storage import avatar_public_url


def _student_class_name(db: Session, user_id) -> str | None:
    enrollment = get_active_enrollment(db, user_id)
    if not enrollment:
        return None
    cls = db.query(Class).filter(Class.id == enrollment.class_id).first()
    return cls.name if cls else None


def _student_parent_names(db: Session, user_id) -> list[str] | None:
    links = (
        db.query(ParentStudentLink)
        .filter(ParentStudentLink.student_user_id == user_id)
        .all()
    )
    if not links:
        return None
    parent_ids = [link.parent_user_id for link in links]
    parents = db.query(User).filter(User.id.in_(parent_ids)).all()
    names = [p.name for p in parents]
    return names or None


def _profile_child_items_for_parent(db: Session, user_id) -> list[ProfileChildItem] | None:
    child_ids = get_parent_child_ids(db, user_id)
    if not child_ids:
        return None
    items: list[ProfileChildItem] = []
    for child_id in child_ids:
        child = db.query(User).filter(User.id == child_id).first()
        if not child:
            continue
        class_name = _student_class_name(db, child.id) or ""
        items.append(
            ProfileChildItem(
                id=str(child.id),
                name=child.name,
                class_name=class_name,
                avatar_url=avatar_public_url(child.avatar_path),
            )
        )
    return items or None


def _teacher_assignments(db: Session, user_id) -> list[ProfileAssignmentItem] | None:
    rows = (
        db.query(TeacherAssignment)
        .filter(TeacherAssignment.teacher_user_id == user_id)
        .all()
    )
    if not rows:
        return None
    class_ids = {row.class_id for row in rows}
    subject_ids = {row.subject_id for row in rows}
    classes = {
        c.id: c.name for c in db.query(Class).filter(Class.id.in_(class_ids)).all()
    }
    subjects = {
        s.id: s.name
        for s in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()
    }
    items: list[ProfileAssignmentItem] = []
    for row in rows:
        class_name = classes.get(row.class_id, "")
        subject_name = subjects.get(row.subject_id, "")
        items.append(
            ProfileAssignmentItem(class_name=class_name, subject_name=subject_name)
        )
    items.sort(key=lambda item: (item.class_name, item.subject_name))
    return items or None


def build_profile_response(db: Session, user: User) -> ProfileResponse:
    role = user.role
    class_name = None
    parent_names = None
    children = None
    assignments = None

    if role == "student":
        class_name = _student_class_name(db, user.id)
        parent_names = _student_parent_names(db, user.id)
    elif role == "parent":
        children = _profile_child_items_for_parent(db, user.id)
    elif role == "teacher":
        assignments = _teacher_assignments(db, user.id)

    return ProfileResponse(
        id=str(user.id),
        name=user.name,
        role=role,
        email=user.email,
        phone=user.phone,
        birth_date=user.birth_date,
        created_at=user.created_at or now(),
        last_login_at=user.last_login_at,
        avatar_url=avatar_public_url(user.avatar_path),
        class_name=class_name,
        parent_names=parent_names,
        children=children,
        assignments=assignments,
    )
