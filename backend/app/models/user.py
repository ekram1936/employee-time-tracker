import uuid
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200),  nullable=False)
    email = Column(String(255),  unique=True, nullable=False, index=True)
    hashed_password = Column(String(255),  nullable=False)
    department = Column(String(100),  default="")
    position = Column(String(100),  default="")
    annual_vacation_days = Column(Integer,       default=30)
    used_vacation_days = Column(Integer,       default=0)
    daily_target_hours = Column(Float,         default=8.0)
    is_active = Column(Boolean,       default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    time_entries = relationship(
        "TimeEntry",
        back_populates="user",
        cascade="all, delete-orphan",
    )
