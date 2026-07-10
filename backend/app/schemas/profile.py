from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileChildItem(BaseModel):
    id: str
    name: str
    class_name: str
    avatar_url: str | None = None


class ProfileAssignmentItem(BaseModel):
    class_name: str
    subject_name: str


class ProfileResponse(BaseModel):
    id: str
    name: str
    role: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    created_at: datetime
    last_login_at: datetime | None = None
    avatar_url: str | None = None
    class_name: str | None = None
    parent_names: list[str] | None = None
    children: list[ProfileChildItem] | None = None
    assignments: list[ProfileAssignmentItem] | None = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    birth_date: date | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


class OkResponse(BaseModel):
    ok: bool = True
