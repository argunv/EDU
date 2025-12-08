from pydantic import BaseModel


class ClassResponse(BaseModel):
    id: str
    name: str
    shift: str | None = None
    shift_locked: bool | None = None
    max_lessons_per_week: int | None = None

    class Config:
        from_attributes = True


class StudentOptionResponse(BaseModel):
    id: str
    name: str
    class_name: str
