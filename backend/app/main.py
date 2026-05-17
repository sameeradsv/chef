import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.routers import decisions, ingredients, recipes, user
from app.routers.auth import router as auth_router
from app.routers.grocery import router as grocery_router
from app.routers.history import router as history_router
from app.seed import seed_database

app = FastAPI(
    title="Chef API",
    description="Kitchen decision intelligence — deterministic scoring first",
    version="0.2.0",
)

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://sameeradsv.github.io",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ingredients.router)
app.include_router(recipes.router)
app.include_router(decisions.router)
app.include_router(user.router)
app.include_router(history_router)
app.include_router(grocery_router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok", "service": "chef-api"}
