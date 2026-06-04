import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings
from .routers import auth, users, time_entries
app = FastAPI(title="TimeTrack API", version="1.0.0",
              docs_url="/api/docs", redoc_url=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router,         prefix="/api")
app.include_router(users.router,        prefix="/api")
app.include_router(time_entries.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve built frontend — only if dist folder actually exists
DIST = "/app/dist"
ASSETS = f"{DIST}/assets"

if os.path.isdir(ASSETS):
    app.mount("/assets", StaticFiles(directory=ASSETS), name="assets")

if os.path.isdir(DIST):
    @app.get("/{full_path:path}")
    def spa(full_path: str):
        file_path = f"{DIST}/{full_path}"
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(f"{DIST}/index.html")
