from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..security import verify_password, create_access_token, get_current_user
from ..crud.user import get_user_by_email, update_user_password, create_user
from ..schemas.user import UserCreate
from app.email_validator import validate_email_address


router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Request Models ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer"}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )
    update_user_password(db, current_user.id, payload.new_password)
    return {"message": "Password updated successfully"}


@router.post("/register", status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    # ── 1. ZeroBounce email validation ────────────────────────────────────────
    is_allowed, reason = validate_email_address(
        payload.email)  # no asyncio.run
    if not is_allowed:
        raise HTTPException(status_code=422, detail=reason)

    # ── 2. Duplicate email check ──────────────────────────────────────────────
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="Email already registered")

    # ── 3. Create user + return token ─────────────────────────────────────────
    user = create_user(db, payload)
    token = create_access_token({"sub": user.id})
    return {"access_token": token, "token_type": "bearer"}
