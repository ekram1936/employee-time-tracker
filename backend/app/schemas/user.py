from pydantic import BaseModel, EmailStr
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: str = ""
    position: str = ""
    country: str = "DE"
    annual_vacation_days: int = 30
    daily_target_hours: float = 8.0


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    country: Optional[str] = None
    annual_vacation_days: Optional[int] = None
    daily_target_hours: Optional[float] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    department: str
    position: str
    country: str
    annual_vacation_days: int
    daily_target_hours: float

    class Config:
        from_attributes = True
