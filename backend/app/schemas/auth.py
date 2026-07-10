from app.schemas.user import UserResponse
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    login: str  # email
    password: str


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    user: "UserResponse"


class OkResponse(BaseModel):
    ok: bool = True


TokenResponse.model_rebuild()
