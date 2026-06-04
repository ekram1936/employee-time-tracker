"""Run once at container startup to create tables."""
from app.database import engine, SessionLocal, Base
from app.security import get_password_hash
from app.models.time_entry import TimeEntry
from app.models.user import User
import warnings
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

warnings.filterwarnings("ignore", ".*error reading bcrypt version.*")


def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

    seed_email = os.getenv("SEED_EMAIL")
    seed_password = os.getenv("SEED_PASSWORD")
    seed_name = os.getenv("SEED_NAME", "Dev User")

    if not seed_email or not seed_password:
        print("No SEED_EMAIL/SEED_PASSWORD set — skipping seed.")
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(
            User.email == seed_email.lower()).first()
        if existing:
            print(f"User {seed_email} already exists — skipping seed.")
            return

        user = User(
            name=seed_name,
            email=seed_email.lower(),
            hashed_password=get_password_hash(seed_password),
            department="Development",
            position="Developer",
            annual_vacation_days=30,
            daily_target_hours=8.0,
        )
        db.add(user)
        db.commit()
        print(f"Seeded dev user: {seed_email}")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database ready.")
