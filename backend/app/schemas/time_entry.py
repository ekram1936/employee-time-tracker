from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime


class TimeEntryCreate(BaseModel):
    date:          str
    start_time:    str = ""
    end_time:      str = ""
    break_minutes: int = 0
    work_minutes:  int = 0
    note:          str = ""
    type: Literal["work", "vacation", "sick"] = "work"

    # Guard: net work must not exceed 600 minutes (10h) at schema level
    @field_validator("work_minutes")
    @classmethod
    def validate_work_minutes(cls, v: int) -> int:
        if v < 0:
            raise ValueError("work_minutes cannot be negative")
        if v > 600:
            raise ValueError("work_minutes cannot exceed 600 (10 h net)")
        return v

    @field_validator("break_minutes")
    @classmethod
    def validate_break_minutes(cls, v: int) -> int:
        if v < 0:
            raise ValueError("break_minutes cannot be negative")
        return v


class TimeEntryUpdate(BaseModel):
    date:          Optional[str] = None
    start_time:    Optional[str] = None
    end_time:      Optional[str] = None
    break_minutes: Optional[int] = None
    work_minutes:  Optional[int] = None
    note:          Optional[str] = None
    type: Optional[Literal["work", "vacation", "sick"]] = None

    @field_validator("work_minutes")
    @classmethod
    def validate_work_minutes(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < 0:
            raise ValueError("work_minutes cannot be negative")
        if v > 600:
            raise ValueError("work_minutes cannot exceed 600 (10 h net)")
        return v

    @field_validator("break_minutes")
    @classmethod
    def validate_break_minutes(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v < 0:
            raise ValueError("break_minutes cannot be negative")
        return v


class TimeEntryResponse(BaseModel):
    id:            str
    user_id:       str
    date:          str
    start_time:    str
    end_time:      str
    break_minutes: int
    work_minutes:  int
    note:          str
    type:          str
    created_at:    datetime
    updated_at:    datetime

    class Config:
        from_attributes = True
