from app.models.base import Base
from app.models.user import User, RefreshToken, PasswordResetToken
from app.models.class_model import Class
from app.models.subject import Subject
from app.models.class_subject import ClassSubject
from app.models.student import Student  # legacy: pupils are User(role=student); table kept for schema
from app.models.teacher import TeacherClass, TeacherSubject
from app.models.parent import ParentChild
from app.models.schedule import ScheduleSlot
from app.models.grade import Grade
from app.models.lesson import Lesson, LessonAttendance
from app.models.homework import Homework
from app.models.school_settings import SchoolSettings

__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "PasswordResetToken",
    "Class",
    "Subject",
    "ClassSubject",
    "Student",
    "TeacherClass",
    "TeacherSubject",
    "ParentChild",
    "ScheduleSlot",
    "Grade",
    "Lesson",
    "LessonAttendance",
    "Homework",
    "SchoolSettings",
]
