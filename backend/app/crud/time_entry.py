from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime, timezone

from ..models.time_entry import TimeEntry
from ..models.user import User
from ..schemas.time_entry import TimeEntryCreate, TimeEntryUpdate


# ─── Vacation balance sync ────────────────────────────────────────────────────

def _recalc_used_days(db: Session, user_id: str) -> int:
    """Count distinct vacation dates for the user. Sick days do NOT consume quota."""
    return (
        db.query(TimeEntry.date)
        .filter(
            TimeEntry.user_id == user_id,
            TimeEntry.type == "vacation",
        )
        .distinct()
        .count()
    )


def _sync_user_vacation_balance(db: Session, user_id: str) -> None:
    """Update user.used_vacation_days in memory. Caller must commit."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    user.used_vacation_days = _recalc_used_days(db, user_id)
    # ✅ No db.commit() here — caller commits once for everything


# ─── CRUD ─────────────────────────────────────────────────────────────────────

def create_entry(db: Session, user_id: str, payload: TimeEntryCreate) -> TimeEntry:
    entry = TimeEntry(user_id=user_id, **payload.model_dump())
    db.add(entry)

    # Sync balance in memory before the single commit
    _sync_user_vacation_balance(db, user_id)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("An entry already exists for this date.")

    db.refresh(entry)
    return entry


def get_entry(db: Session, entry_id: str, user_id: str) -> Optional[TimeEntry]:
    return (
        db.query(TimeEntry)
        .filter(TimeEntry.id == entry_id, TimeEntry.user_id == user_id)
        .first()
    )


def list_entries(
    db: Session,
    user_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[TimeEntry]:
    q = db.query(TimeEntry).filter(TimeEntry.user_id == user_id)
    if start_date:
        q = q.filter(TimeEntry.date >= start_date)
    if end_date:
        q = q.filter(TimeEntry.date <= end_date)
    return q.order_by(TimeEntry.date.desc()).all()


def update_entry(
    db: Session,
    entry_id: str,
    user_id: str,
    payload: TimeEntryUpdate,
) -> Optional[TimeEntry]:
    entry = get_entry(db, entry_id, user_id)
    if not entry:
        return None

    # This means break_minutes=0 IS applied (it was set), but omitted fields are skipped
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)

    # Manually update updated_at (onupdate doesn't fire on setattr, only on flush)
    entry.updated_at = datetime.now(timezone.utc)

    _sync_user_vacation_balance(db, user_id)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("An entry already exists for this date.")

    db.refresh(entry)
    return entry


def delete_entry(db: Session, entry_id: str, user_id: str) -> bool:
    entry = get_entry(db, entry_id, user_id)
    if not entry:
        return False

    db.delete(entry)
    _sync_user_vacation_balance(db, user_id)     # recalc before commit
    db.commit()
    return True
