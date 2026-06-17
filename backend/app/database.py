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
    else {"pool_pre_ping": True, "pool_recycle": 280, "pool_size": 2, "max_overflow": 3}
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
        if "people_count" not in existing:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN people_count INTEGER DEFAULT 2"))
            conn.commit()
        if "cooking_skill" not in existing:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN cooking_skill INTEGER DEFAULT 3"))
            conn.commit()
        if "restaurant_delivery_json" not in existing:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN restaurant_delivery_json TEXT DEFAULT '{}'"))
            conn.commit()
        if "cooking_history" in inspector.get_table_names():
            existing_hist = {c["name"] for c in inspector.get_columns("cooking_history")}
            if "cost" not in existing_hist:
                conn.execute(text("ALTER TABLE cooking_history ADD COLUMN cost REAL"))
                conn.commit()
            if "created_at" not in existing_hist:
                conn.execute(text("ALTER TABLE cooking_history ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"))
                conn.commit()
            if "restaurant_name" not in existing_hist:
                conn.execute(text("ALTER TABLE cooking_history ADD COLUMN restaurant_name VARCHAR(200)"))
                conn.commit()
        if "webauthn_credentials" not in inspector.get_table_names():
            conn.execute(text(
                "CREATE TABLE webauthn_credentials ("
                "credential_id TEXT PRIMARY KEY, "
                "public_key TEXT NOT NULL, "
                "sign_count INTEGER DEFAULT 0, "
                "user_id TEXT NOT NULL, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
            ))
            conn.execute(text("CREATE INDEX ix_webauthn_cred_user ON webauthn_credentials (user_id)"))
            conn.commit()
        if "webauthn_challenges" not in inspector.get_table_names():
            conn.execute(text(
                "CREATE TABLE webauthn_challenges ("
                "id VARCHAR(64) PRIMARY KEY, "
                "challenge VARCHAR(128) NOT NULL, "
                "user_id TEXT, "
                "expires_at DATETIME NOT NULL, "
                "created_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
            ))
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
        if "people_count" not in existing_prefs:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN people_count INTEGER DEFAULT 2"))
            conn.commit()
        if "cooking_skill" not in existing_prefs:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN cooking_skill INTEGER DEFAULT 3"))
            conn.commit()
        if "restaurant_delivery_json" not in existing_prefs:
            conn.execute(text("ALTER TABLE user_preferences ADD COLUMN restaurant_delivery_json TEXT DEFAULT '{}'"))
            conn.commit()
        if "cooking_history" in inspector.get_table_names():
            existing_hist = {c["name"] for c in inspector.get_columns("cooking_history")}
            if "cost" not in existing_hist:
                conn.execute(text("ALTER TABLE cooking_history ADD COLUMN cost FLOAT"))
                conn.commit()
            if "created_at" not in existing_hist:
                conn.execute(text("ALTER TABLE cooking_history ADD COLUMN created_at TIMESTAMP DEFAULT NOW()"))
                conn.commit()
            if "restaurant_name" not in existing_hist:
                conn.execute(text("ALTER TABLE cooking_history ADD COLUMN restaurant_name VARCHAR(200)"))
                conn.commit()
        existing_accounts = {c["name"] for c in inspector.get_columns("user_accounts")}
        if "cortex_user_id" not in existing_accounts:
            conn.execute(text("ALTER TABLE user_accounts ADD COLUMN cortex_user_id INTEGER"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_user_accounts_cortex_user_id "
                "ON user_accounts (cortex_user_id) WHERE cortex_user_id IS NOT NULL"
            ))
            conn.commit()
        if "webauthn_credentials" not in inspector.get_table_names():
            conn.execute(text(
                "CREATE TABLE webauthn_credentials ("
                "credential_id TEXT PRIMARY KEY, "
                "public_key TEXT NOT NULL, "
                "sign_count INTEGER DEFAULT 0, "
                "user_id TEXT NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            ))
            conn.execute(text("CREATE INDEX ix_webauthn_cred_user ON webauthn_credentials (user_id)"))
            conn.commit()
        if "webauthn_challenges" not in inspector.get_table_names():
            conn.execute(text(
                "CREATE TABLE webauthn_challenges ("
                "id VARCHAR(64) PRIMARY KEY, "
                "challenge VARCHAR(128) NOT NULL, "
                "user_id TEXT, "
                "expires_at TIMESTAMP NOT NULL, "
                "created_at TIMESTAMP DEFAULT NOW())"
            ))
            conn.commit()


def _ensure_migrations_table() -> None:
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(name VARCHAR(100) PRIMARY KEY, "
            "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        ))
        conn.commit()


def _migration_done(name: str) -> bool:
    from sqlalchemy import text
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT 1 FROM schema_migrations WHERE name = :n"), {"n": name}
        ).fetchone() is not None


def _mark_done(name: str) -> None:
    from sqlalchemy import text
    with engine.connect() as conn:
        if DATABASE_URL.startswith("sqlite"):
            conn.execute(text("INSERT OR IGNORE INTO schema_migrations (name) VALUES (:n)"), {"n": name})
        else:
            conn.execute(text("INSERT INTO schema_migrations (name) VALUES (:n) ON CONFLICT DO NOTHING"), {"n": name})
        conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
