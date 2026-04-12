"""
Общие фикстуры для API-тестов.

Требуется PostgreSQL (DATABASE_URL=postgresql+psycopg2://...).
Каждый тест получает изолированную сессию и схему (create_all/drop_all).
"""
import os

# До любых импортов app.*: в main монтируются маршруты без префикса /api для совместимости с тестами.
os.environ["ENVIRONMENT"] = "test"

import uuid
from collections.abc import Generator
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.base import Base
from app.models.user import User
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.teacher import TeacherClass, TeacherSubject
from app.models.parent import ParentChild
from app.models.role_profiles import ClassEnrollment, ParentStudentLink, TeacherAssignment, UserRole
from app.models.school_settings import SchoolSettings
from app.services.auth import hash_password, create_access_token
from app.db.session import engine as _app_engine, SessionLocal as _AppSessionLocal
from app.main import app

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///:memory:")

# PostgreSQL обязателен; используем тот же engine/session, что и приложение
if "postgresql" not in DATABASE_URL:
    _engine = None
    _SessionLocal = None
else:
    _engine = _app_engine
    _SessionLocal = _AppSessionLocal


@pytest.fixture(scope="session")
def test_engine():
    """Движок на сессию тестов."""
    if _engine is None:
        pytest.skip("Требуется PostgreSQL. Укажите DATABASE_URL=postgresql+psycopg2://...")
    try:
        _engine.connect().close()
    except Exception as e:
        pytest.skip(f"PostgreSQL недоступен: {e}")
    return _engine


def _truncate_all(session: Session) -> None:
    """Очистить все таблицы (схема уже есть из миграций)."""
    result = session.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'alembic_version'
            """
        )
    ).fetchall()
    tables = [row[0] for row in result]
    if not tables:
        return
    # TRUNCATE ... CASCADE для очистки с учётом FK
    session.execute(text("TRUNCATE " + ", ".join(f'"{n}"' for n in tables) + " CASCADE"))
    session.commit()


@pytest.fixture
def db(test_engine) -> Generator[Session, None, None]:
    """
    Сессия БД на тест. Схема из миграций (не create_all).
    После теста — TRUNCATE всех таблиц для изоляции.
    """
    if _SessionLocal is None:
        pytest.skip("Требуется PostgreSQL. Укажите DATABASE_URL=postgresql+psycopg2://...")
    session = _SessionLocal()
    try:
        session.execute(text("SELECT 1"))
    except Exception as e:
        session.close()
        pytest.skip(f"PostgreSQL недоступен: {e}")
    try:
        yield session
    finally:
        try:
            _truncate_all(session)
        except Exception:
            session.rollback()
        session.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    """HTTP-клиент к API. БД не подменяется — приложение использует ту же DATABASE_URL и видит данные, закоммиченные в db."""
    with TestClient(app) as c:
        yield c


# --------------- Данные для тестов ---------------


def _make_class(id=None, name="1A", shift="morning", year_start=2024, archived=False):
    if id is None:
        id = uuid.uuid4()
    grade = int("".join(c for c in name if c.isdigit()) or "1")
    letter = "".join(c for c in name if c.isalpha()) or "А"
    return Class(
        id=id,
        name=name,
        year_start=year_start,
        grade=grade,
        letter=letter,
        shift=shift,
        shift_locked=False,
        max_lessons_per_week=None,
        archived=archived,
    )


@pytest.fixture
def class_1a(db: Session):
    cls = _make_class(name="1A")
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


@pytest.fixture
def class_9a(db: Session):
    cls = _make_class(name="9A")
    db.add(cls)
    db.commit()
    db.refresh(cls)
    return cls


@pytest.fixture
def subject_math(db: Session):
    sub = Subject(id=uuid.uuid4(), name="Математика")
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@pytest.fixture
def admin_user(db: Session, class_9a: Class):
    user = User(
        id=uuid.uuid4(),
        email="admin@test.com",
        password_hash=hash_password("password"),
        name="Admin",
        role="admin",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def teacher_user(db: Session, class_1a: Class, class_9a: Class, subject_math: Subject):
    user = User(
        id=uuid.uuid4(),
        email="teacher@test.com",
        password_hash=hash_password("password"),
        name="Teacher",
        role="teacher",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="teacher"))
    db.commit()
    db.refresh(user)
    db.add(TeacherClass(teacher_id=user.id, class_id=class_1a.id))
    db.add(TeacherSubject(teacher_id=user.id, subject_id=subject_math.id))
    db.add(TeacherAssignment(teacher_user_id=user.id, class_id=class_1a.id, subject_id=subject_math.id))
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def student_user(db: Session, class_1a: Class):
    user = User(
        id=uuid.uuid4(),
        email="student@test.com",
        password_hash=hash_password("password"),
        name="Student",
        role="student",
        class_id=class_1a.id,
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="student"))
    db.commit()
    db.add(ClassEnrollment(student_user_id=user.id, class_id=class_1a.id))
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def parent_user(db: Session, student_user: User):
    user = User(
        id=uuid.uuid4(),
        email="parent@test.com",
        password_hash=hash_password("password"),
        name="Parent",
        role="parent",
    )
    db.add(user)
    db.commit()
    db.add(UserRole(user_id=user.id, role="parent"))
    db.commit()
    db.refresh(user)
    db.add(ParentChild(parent_id=user.id, child_id=student_user.id))
    db.add(ParentStudentLink(parent_user_id=user.id, student_user_id=student_user.id))
    db.commit()
    db.refresh(user)
    return user


# --------------- Заголовки авторизации ---------------


@pytest.fixture
def auth_headers(admin_user: User):
    token = create_access_token(str(admin_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def teacher_headers(teacher_user: User):
    token = create_access_token(str(teacher_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_headers(student_user: User):
    token = create_access_token(str(student_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def parent_headers(parent_user: User):
    token = create_access_token(str(parent_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def journal_grade_date() -> date:
    """Пн–Пт для колонок журнала; в субботу/воскресенье — ближайший предыдущий будний день."""
    d = date.today()
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d
