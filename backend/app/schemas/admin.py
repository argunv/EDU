from pydantic import BaseModel, Field
from typing import Literal


class ApproveUserRequest(BaseModel):
    role: Literal["teacher", "student", "parent", "admin"]
    class_id: str | None = None
    child_ids: list[str] | None = None
    class_ids: list[str] | None = None
    subject_ids: list[str] | None = None


class PatchRoleRequest(BaseModel):
    role: Literal["teacher", "student", "parent", "admin"]
    class_id: str | None = None
    child_ids: list[str] | None = None
    class_ids: list[str] | None = None
    subject_ids: list[str] | None = None


# Admin schedule
class BusyTeacherAtSlotResponse(BaseModel):
    teacher_name: str
    class_name: str


class AdminScheduleSlotResponse(BaseModel):
    id: str
    day_label: str
    lesson_number: int
    time: str
    class_id: str
    class_name: str
    shift: str
    subject_id: str
    subject_name: str
    teacher_id: str | None = None
    teacher_name: str
    room: str | None = None
    note: str | None = None
    is_cancelled: bool | None = None


class AdminScheduleSlotDraft(BaseModel):
    day_label: str
    lesson_number: int
    time: str
    class_id: str
    class_name: str
    shift: str
    subject_id: str
    subject_name: str
    teacher_id: str | None = None
    teacher_name: str
    room: str | None = None
    note: str | None = None
    is_cancelled: bool | None = None


class AdminScheduleChange(BaseModel):
    key: str
    slot: AdminScheduleSlotDraft | None = None


class AdminSchoolSettingsResponse(BaseModel):
    is_two_shift: bool
    class_shift_rules: dict[str, str] = Field(default_factory=dict)


class AdminSubjectResponse(BaseModel):
    id: str
    name: str
    teachers: list[str] = []
    teacher_id: str | None = None
    teacher_name: str | None = None


class CreateSubjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class ClassSubjectSetRequest(BaseModel):
    subject_id: str
    teacher_id: str | None = None


class AdminTeacherOption(BaseModel):
    id: str
    name: str


# Admin classes CRUD
class AdminClassResponse(BaseModel):
    id: str
    name: str
    year_start: int
    grade: int
    letter: str
    shift: str | None = None
    shift_locked: bool | None = None
    max_lessons_per_week: int | None = None
    archived: bool


class CreateClassRequest(BaseModel):
    year_start: int = Field(..., ge=2000, le=2100)
    grade: int = Field(..., ge=1, le=11)
    letter: str = Field(..., min_length=1, max_length=5)
    shift: str | None = None
    shift_locked: bool | None = None
    max_lessons_per_week: int | None = None


class PatchClassRequest(BaseModel):
    shift: str | None = None
    shift_locked: bool | None = None
    max_lessons_per_week: int | None = None


# Admin journal
class AdminJournalStudent(BaseModel):
    id: str
    name: str
    # 2,3,4,5,'Н',null — в том же порядке, что и dates
    grades: list[int | str | None]
    absences: int


class AdminJournalResponse(BaseModel):
    lesson_meta: dict  # title, last_updated
    # ISO-даты (Пн–Пт) по расписанию, включая сегодня если урок в этот день
    dates: list[str]
    students: list[AdminJournalStudent]
