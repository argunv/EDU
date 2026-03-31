from pydantic import BaseModel


class ChildResponse(BaseModel):
    id: str
    name: str
    class_name: str


class ScheduleItemResponse(BaseModel):
    id: str
    day_label: str
    lesson_number: int
    time: str
    subject: str
    teacher_name: str
    room: str | None = None
    subject_id: str | None = None  # для привязки оценки к предмету
    # оценка за этот предмет в этот день (2, 3, 4, 5, Н), если есть
    grade: str | None = None


class HomeworkItemResponse(BaseModel):
    id: str
    due_date_label: str
    subject: str
    text: str


class SubjectProgressResponse(BaseModel):
    subject: str
    teacher_name: str
    grades: list[int | str]  # 0-5, 'Н'
    grade_dates: list[str]  # ISO date per grade, same order as grades
    absences_count: int
