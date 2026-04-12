from pydantic import BaseModel, ConfigDict


class ClassResponse(BaseModel):
    id: str
    name: str
    shift: str | None = None
    shift_locked: bool | None = None
    max_lessons_per_week: int | None = None

    model_config = ConfigDict(from_attributes=True)


class StudentOptionResponse(BaseModel):
    id: str
    name: str
    class_name: str
