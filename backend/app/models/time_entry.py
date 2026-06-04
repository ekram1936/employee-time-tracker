import uuid
import enum
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey,
    Enum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from ..database import Base


class EntryType(str, enum.Enum):
    work = "work"
    vacation = "vacation"
    sick = "sick"


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"),
                     nullable=False, index=True)
    date = Column(String(10), nullable=False)
    start_time = Column(String(5),  default="")
    end_time = Column(String(5),  default="")
    break_minutes = Column(Integer,    default=0)
    work_minutes = Column(Integer,    default=0)
    note = Column(String(500), default="")
    type = Column(Enum(EntryType), default=EntryType.work)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="time_entries")

    # DB-level guarantee: one entry per user per date
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
    )
