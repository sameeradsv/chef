import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{DATA_DIR / 'chef.db'}",
)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# Neon (and other managed PG) drops idle connections; pre-ping detects stale
# connections and pool_recycle discards them before the server-side timeout.
pool_kwargs = (
    {}
    if DATABASE_URL.startswith("sqlite")
    else {"pool_pre_ping": True, "pool_recycle": 280}
)
engine = create_engine(DATABASE_URL, connect_args=connect_args, **pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _migrate_sqlite() -> None:
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "auth_sessions" not in inspector.get_table_names():
            conn.execute(text(
                "CREATE TABLE auth_sessions ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "token VARCHAR(64) NOT NULL UNIQUE, "
                "user_id VARCHAR(36) NOT NULL REFERENCES user_accounts(id), "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "expires_at DATETIME NOT NULL"
                ")"
            ))
            conn.execute(text("CREATE INDEX ix_auth_sessions_token ON auth_sessions (token)"))
            conn.execute(text("CREATE INDEX ix_auth_sessions_user_id ON auth_sessions (user_id)"))
            conn.commit()
        # Add columns introduced after initial deploy
        existing = {c["name"] for c in inspector.get_columns("user_preferences")}
        if "vegetarian" not in existing:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN vegetarian BOOLEAN DEFAULT 1"))
            conn.commit()
        if "skipped_ingredients" not in existing:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN skipped_ingredients TEXT DEFAULT ''"))
            conn.commit()
        if "city" not in existing:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN city VARCHAR(100) DEFAULT ''"))
            conn.commit()


def _migrate_postgres() -> None:
    if DATABASE_URL.startswith("sqlite"):
        return
    with engine.connect() as conn:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "user_preferences" not in inspector.get_table_names():
            return
        existing_prefs = {c["name"] for c in inspector.get_columns("user_preferences")}
        if "vegetarian" not in existing_prefs:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN vegetarian BOOLEAN DEFAULT TRUE"))
            conn.commit()
        if "skipped_ingredients" not in existing_prefs:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN skipped_ingredients TEXT DEFAULT ''"))
            conn.commit()
        if "city" not in existing_prefs:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN city VARCHAR(100) DEFAULT ''"))
            conn.commit()
        existing_accounts = {c["name"] for c in inspector.get_columns("user_accounts")}
        if "cortex_user_id" not in existing_accounts:
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN cortex_user_id INTEGER"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_accounts_cortex_user_id "
                "ON user_accounts (cortex_user_id) WHERE cortex_user_id IS NOT NULL"
            ))
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
