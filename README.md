# 🕐 Employee Time Tracker

A full-stack time tracking web application built with **FastAPI**, **React**, **PostgreSQL**, and **Docker**. Employees can clock in/out, track work hours, manage vacation and sick days, and export monthly summaries — all from a clean, modern UI.

---

## ✨ Features

- **Clock in / Clock out** — live timer with elapsed tracking
- **Resume sessions** — continue a partially logged workday
- **Break auto-calculation** — German labor law compliant (30 min > 8h, 60 min > 10h)
- **10-hour net daily cap** — enforced on both frontend and backend
- **Vacation & sick day management** — via modal with notes
- **Public holiday detection** — Bavaria (DE-BY) holidays via Nager.AT API
- **Monthly summary** — with overtime/deficit calculation
- **CSV export** — full month export with all entry details
- **JWT authentication** — secure login with 24h token expiry
- **User profile** — configurable daily target hours and annual vacation days
- **Responsive UI** — works on desktop and mobile

---

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Git

### 1. Clone the repository

```bash
git clone https://github.com/yourname/employee-time-tracker.git
cd employee-time-tracker
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` and fill in the values:

```env
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=your_generated_secret_key_here

DATABASE_URL=postgresql://timetrack:timetrack123@postgres:5432/employee_tracking
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:5173"]

# Optional: seed a dev user on first startup (leave empty in production)
SEED_EMAIL=
SEED_PASSWORD=
SEED_NAME=
```

Generate a strong `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Start all services

```bash
docker compose up --build
```

This starts three containers:

- `employee_tracking_db` — PostgreSQL on port `5432`
- `employee_tracking_api` — FastAPI on port `8000`
- `employee_tracking_frontend` — React (Nginx) on port `3000`

### 4. Open the app

```
http://localhost:3000
```

Register a new account and start tracking.

---

## 🔄 Daily Usage

```bash
# Start (no rebuild needed if code hasn't changed)
docker compose up -d

# Stop (data is preserved)
docker compose down

# Rebuild after code changes
docker compose up --build

# View live logs
docker compose logs -f api
docker compose logs -f frontend
```

> ⚠️ **Never run `docker compose down -v`** — the `-v` flag deletes your database volume and all data.

---

## 🌐 API Reference

Base URL: `http://localhost:8000/api`

All endpoints except `/auth/login` and `POST /users` require:

```
Authorization: Bearer <jwt_token>
```

### Auth

| Method | Endpoint                | Description                     |
| ------ | ----------------------- | ------------------------------- |
| `POST` | `/auth/login`           | Login — returns JWT token       |
| `POST` | `/auth/change-password` | Change password (authenticated) |

### Users

| Method  | Endpoint    | Description                                           |
| ------- | ----------- | ----------------------------------------------------- |
| `POST`  | `/users`    | Register new user                                     |
| `GET`   | `/users/me` | Get current user profile                              |
| `PATCH` | `/users/me` | Update profile (name, department, target hours, etc.) |

### Time Entries

| Method   | Endpoint             | Description                                                |
| -------- | -------------------- | ---------------------------------------------------------- |
| `GET`    | `/time-entries`      | List entries (optional `?start=YYYY-MM-DD&end=YYYY-MM-DD`) |
| `POST`   | `/time-entries`      | Create entry                                               |
| `PATCH`  | `/time-entries/{id}` | Update entry                                               |
| `DELETE` | `/time-entries/{id}` | Delete entry                                               |

### Interactive API Docs

FastAPI auto-generates docs at:

```
http://localhost:8000/docs      # Swagger UI
http://localhost:8000/redoc     # ReDoc
```

---

## 🔒 Security

- Passwords hashed with **bcrypt** (72-byte truncation handled)
- JWT tokens signed with **HS256** using `SECRET_KEY`
- Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 1440 = 24h)
- All endpoints (except register/login) protected by `get_current_user` dependency
- Each user can only read/write their own data — no cross-user access
- `SECRET_KEY` and `DATABASE_URL` must be set via `.env` — no hardcoded defaults in production

---

## 🗃 Database

### Technology

PostgreSQL 15 via Docker, managed by SQLAlchemy ORM.

### Models

**User**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (string) | Primary key |
| `name` | String | |
| `email` | String | Unique, lowercase |
| `hashed_password` | String | bcrypt |
| `department` | String | Optional |
| `position` | String | Optional |
| `daily_target_hours` | Float | Default: 8.0 |
| `annual_vacation_days` | Integer | Default: 30 |
| `created_at` | Timestamp | Auto |

**TimeEntry**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (string) | Primary key |
| `user_id` | String (FK) | References users.id |
| `date` | String (YYYY-MM-DD) | |
| `start_time` | String (HH:MM) | |
| `end_time` | String (HH:MM) | |
| `break_minutes` | Integer | Auto-calculated |
| `work_minutes` | Integer | Net work time |
| `type` | Enum | `work`, `vacation`, `sick` |
| `note` | String | Optional |
| `created_at` | Timestamp | Auto |
| `updated_at` | Timestamp | Auto |

Unique constraint: one entry per `(user_id, date)`.

### Backup & Restore

```bash
# Backup
docker compose exec db pg_dump -U timetrack employee_tracking > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U timetrack employee_tracking < backup_20260604.sql
```

---

## ⚙️ Business Rules

| Rule                   | Detail                                                     |
| ---------------------- | ---------------------------------------------------------- |
| **Daily cap**          | Max 10h net work per day                                   |
| **Break: > 8h span**   | 30 min break deducted automatically                        |
| **Break: > 10h span**  | 60 min break deducted automatically                        |
| **Public holidays**    | Bavaria (DE-BY) — cannot clock in                          |
| **Vacation/sick days** | Cannot clock in on same day                                |
| **One entry per day**  | Enforced at DB level (unique constraint)                   |
| **Continue session**   | Resumes from existing entry; updates end time on clock-out |

---

## 🛠 Development

### Backend only (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql://timetrack:timetrack123@localhost:5432/employee_tracking
export SECRET_KEY=your_secret_key

# Init DB
python init_db.py

# Run dev server
uvicorn app.main:app --reload --port 8000
```

### Frontend only (without Docker)

```bash
cd frontend
npm install
npm run dev     # Starts on http://localhost:5173
```

> Make sure `vite.config.ts` proxies `/api` to `http://localhost:8000`.

### Adding new database columns

Since the project uses `Base.metadata.create_all()` (not Alembic), new columns must be added manually for existing databases:

```python
# In init_db.py — add idempotent ALTER TABLE statements
with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE time_entries
        ADD COLUMN IF NOT EXISTS new_column VARCHAR DEFAULT '';
    """))
    conn.commit()
```

---

## 🌍 Deployment

For production deployment (Railway, Render, VPS):

1. Set all environment variables on the hosting platform
2. Leave `SEED_EMAIL` / `SEED_PASSWORD` **empty** — users register themselves
3. Use a strong randomly generated `SECRET_KEY`
4. Set `ALLOWED_ORIGINS` to your production domain
5. Use a managed PostgreSQL service or ensure volume persistence

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

MIT License — see `LICENSE` for details.
