from pydantic import BaseModel
from typing import Literal


class LessonResponse(BaseModel):
    id: str
    subject: str
    class_id: str
    class_name: str
    time: str
    room: str | None = None
    topic: str | None = None
    homework_text: str | None = None


class LessonStudentResponse(BaseModel):
    student_id: str
    name: str
    attendance: Literal["present", "absent"]
    grade: int | None = None  # 2,3,4,5


class SubmitGradesEntry(BaseModel):
    student_id: str
    attendance: Literal["present", "absent"]
    grade: int | None = None


class SubmitGradesRequest(BaseModel):
    lesson_id: str
    entries: list[SubmitGradesEntry]
    topic: str | None = None
    homework_text: str | None = None


class JournalSubjectOption(BaseModel):
    id: str
    name: str


class JournalDataResponse(BaseModel):
    class_id: str
    class_name: str
    subject: str
    subject_id: str = ""  # for filtering and saving grades
    # list of subjects for class (for dropdown)
    subjects: list[JournalSubjectOption] = []
    dates: list[str]
    students: list[dict]  # id, name
    # student_id -> date -> grade
    grades: dict[str, dict[str, int | str | None]]


class SaveGradeRequest(BaseModel):
    class_id: str
    student_id: str
    date_iso: str
    value: int | str | None  # 2,3,4,5,'Н',null
    subject_id: str | None = None  # required for progress to show by subject
