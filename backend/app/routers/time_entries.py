from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, List
from ..database import get_db
from ..security import get_current_user
from ..crud.time_entry import create_entry, list_entries, get_entry, update_entry, delete_entry
from ..schemas.time_entry import TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse

router = APIRouter(prefix="/time-entries", tags=["time-entries"])

@router.post("", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
def create(payload: TimeEntryCreate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return create_entry(db, current_user.id, payload)

@router.get("", response_model=List[TimeEntryResponse])
def list_all(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_entries(db, current_user.id, start_date, end_date)

@router.get("/{entry_id}", response_model=TimeEntryResponse)
def get_one(entry_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    entry = get_entry(db, entry_id, current_user.id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@router.put("/{entry_id}", response_model=TimeEntryResponse)
def update(entry_id: str, payload: TimeEntryUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    entry = update_entry(db, entry_id, current_user.id, payload)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry

@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(entry_id: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not delete_entry(db, entry_id, current_user.id):
        raise HTTPException(status_code=404, detail="Entry not found")
