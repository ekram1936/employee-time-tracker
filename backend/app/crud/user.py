from sqlalchemy.orm import Session
from ..models.user import User
from ..schemas.user import UserCreate, UserUpdate
from ..security import get_password_hash


def get_user_by_id(db: Session, user_id: str):
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email.lower()).first()


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        name=payload.name,
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
        department=payload.department,
        position=payload.position,
        country=payload.country,
        annual_vacation_days=payload.annual_vacation_days,
        daily_target_hours=payload.daily_target_hours,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: str, payload: UserUpdate) -> User:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


def update_user_password(db: Session, user_id: str, new_password: str):
    user = get_user_by_id(db, user_id)
    if user:
        user.hashed_password = get_password_hash(new_password)
        db.commit()
