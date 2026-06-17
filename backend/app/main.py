import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.database import (
    Base, SessionLocal, engine,
    _migrate_postgres, _migrate_sqlite,
    _ensure_migrations_table, _migration_done, _mark_done,
)
from app.routers import decisions, ingredients, recipes, user
from app.routers.auth import router as auth_router
from app.routers.grocery import router as grocery_router
from app.routers.history import router as history_router
from app.routers.sync import router as sync_router
from app.routers.vision import router as vision_router
from app.routers.webauthn import router as webauthn_router
from app.routers.agent import router as agent_router
from app.routers.energy import router as energy_router
from app.routers.nutrition import router as nutrition_router
from app.seed import seed_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_migrations_table()
    for name, fn in [
        ("sqlite_schema", _migrate_sqlite),
        ("postgres_schema", _migrate_postgres),
    ]:
        if not _migration_done(name):
            fn()
            _mark_done(name)
    asyncio.get_running_loop().run_in_executor(None, _seed_in_thread)
    yield


app = FastAPI(
    title="Chef API",
    description="Kitchen decision intelligence — deterministic scoring first",
    version="0.2.0",
    lifespan=lifespan,
)

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,https://sameeradsv.github.io",
).split(",")

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(webauthn_router)
app.include_router(ingredients.router)
app.include_router(recipes.router)
app.include_router(decisions.router)
app.include_router(user.router)
app.include_router(history_router)
app.include_router(grocery_router)
app.include_router(sync_router)
app.include_router(vision_router)
app.include_router(energy_router)
app.include_router(nutrition_router)
app.include_router(agent_router)


@app.middleware("http")
async def add_cache_control(request: Request, call_next):
    response = await call_next(request)
    if (
        request.method == "GET"
        and response.status_code == 200
        and not request.url.path.startswith("/api/auth")
        and not request.url.path.startswith("/auth")
    ):
        response.headers["Cache-Control"] = "private, max-age=30"
    return response


def _seed_in_thread() -> None:
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "service": "chef-api"}
