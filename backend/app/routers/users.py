from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..security import get_current_user
from ..crud.user import create_user, get_user_by_email, get_user_by_id, update_user
from ..schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    return create_user(db, payload)

@router.get("/me", response_model=UserResponse)
def me(current_user=Depends(get_current_user)):
    return current_user

@router.put("/{user_id}", response_model=UserResponse)
def update(
    user_id: str,
    payload: UserUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    updated = update_user(db, user_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated
