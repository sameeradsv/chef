import os
from collections.abc import Callable
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


def _migrate_restaurant_delivery_json() -> None:
    """Standalone migration — must be registered separately from postgres_schema."""
    with engine.connect() as conn:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "user_preferences" not in inspector.get_table_names():
            return
        existing = {c["name"] for c in inspector.get_columns("user_preferences")}
        if "restaurant_delivery_json" in existing:
            return
        conn.execute(text(
            "ALTER TABLE user_preferences ADD COLUMN restaurant_delivery_json TEXT DEFAULT '{}'"
        ))
        conn.commit()


def _migrate_history_location_context() -> None:
    """Add per-entry location scope so travel restaurants do not leak into home picks."""
    with engine.connect() as conn:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if "cooking_history" not in inspector.get_table_names():
            return
        existing = {c["name"] for c in inspector.get_columns("cooking_history")}
        if "location_context" not in existing:
            conn.execute(text(
                "ALTER TABLE cooking_history ADD COLUMN location_context VARCHAR(20) DEFAULT 'home'"
            ))
        if "location_label" not in existing:
            conn.execute(text(
                "ALTER TABLE cooking_history ADD COLUMN location_label VARCHAR(120)"
            ))
        conn.commit()


def _migrate_push_reminders() -> None:
    with engine.connect() as conn:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        if DATABASE_URL.startswith("sqlite"):
            if "push_subscriptions" not in tables:
                conn.execute(text(
                    "CREATE TABLE push_subscriptions ("
                    "id VARCHAR(36) PRIMARY KEY, "
                    "user_id VARCHAR(36) NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE, "
                    "endpoint TEXT NOT NULL UNIQUE, "
                    "p256dh TEXT NOT NULL, "
                    "auth TEXT NOT NULL, "
                    "device_name VARCHAR(120), "
                    "platform VARCHAR(80), "
                    "enabled BOOLEAN NOT NULL DEFAULT 1, "
                    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                    "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
                ))
                conn.execute(text("CREATE INDEX ix_push_subscriptions_user_id ON push_subscriptions (user_id)"))
                conn.execute(text("CREATE INDEX ix_push_subscriptions_enabled ON push_subscriptions (enabled)"))
            if "user_reminder_settings" not in tables:
                conn.execute(text(
                    "CREATE TABLE user_reminder_settings ("
                    "user_id VARCHAR(36) PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE, "
                    "enabled BOOLEAN NOT NULL DEFAULT 1, "
                    "morning_time VARCHAR(5) NOT NULL DEFAULT '09:00', "
                    "afternoon_time VARCHAR(5) NOT NULL DEFAULT '14:00', "
                    "evening_time VARCHAR(5) NOT NULL DEFAULT '20:00', "
                    "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
                ))
            if "reminder_dispatch_log" not in tables:
                conn.execute(text(
                    "CREATE TABLE reminder_dispatch_log ("
                    "id VARCHAR(36) PRIMARY KEY, "
                    "user_id VARCHAR(36) NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE, "
                    "reminder_type VARCHAR(20) NOT NULL, "
                    "dispatch_key VARCHAR(80) NOT NULL UNIQUE, "
                    "status VARCHAR(20) NOT NULL DEFAULT 'processing', "
                    "attempts INTEGER NOT NULL DEFAULT 0, "
                    "delivered_count INTEGER NOT NULL DEFAULT 0, "
                    "failed_count INTEGER NOT NULL DEFAULT 0, "
                    "last_error TEXT, "
                    "created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                    "sent_at DATETIME)"
                ))
                conn.execute(text("CREATE INDEX ix_reminder_dispatch_log_user_id ON reminder_dispatch_log (user_id)"))
                conn.execute(text("CREATE INDEX ix_reminder_dispatch_log_reminder_type ON reminder_dispatch_log (reminder_type)"))
                conn.execute(text("CREATE INDEX ix_reminder_dispatch_log_status ON reminder_dispatch_log (status)"))
            conn.commit()
            return

        if "push_subscriptions" not in tables:
            conn.execute(text(
                "CREATE TABLE push_subscriptions ("
                "id VARCHAR(36) PRIMARY KEY, "
                "user_id VARCHAR(36) NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE, "
                "endpoint TEXT NOT NULL UNIQUE, "
                "p256dh TEXT NOT NULL, "
                "auth TEXT NOT NULL, "
                "device_name VARCHAR(120), "
                "platform VARCHAR(80), "
                "enabled BOOLEAN NOT NULL DEFAULT TRUE, "
                "created_at TIMESTAMP DEFAULT NOW(), "
                "updated_at TIMESTAMP DEFAULT NOW())"
            ))
            conn.execute(text("CREATE INDEX ix_push_subscriptions_user_id ON push_subscriptions (user_id)"))
            conn.execute(text("CREATE INDEX ix_push_subscriptions_enabled ON push_subscriptions (enabled)"))
        if "user_reminder_settings" not in tables:
            conn.execute(text(
                "CREATE TABLE user_reminder_settings ("
                "user_id VARCHAR(36) PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE, "
                "enabled BOOLEAN NOT NULL DEFAULT TRUE, "
                "morning_time VARCHAR(5) NOT NULL DEFAULT '09:00', "
                "afternoon_time VARCHAR(5) NOT NULL DEFAULT '14:00', "
                "evening_time VARCHAR(5) NOT NULL DEFAULT '20:00', "
                "updated_at TIMESTAMP DEFAULT NOW())"
            ))
        if "reminder_dispatch_log" not in tables:
            conn.execute(text(
                "CREATE TABLE reminder_dispatch_log ("
                "id VARCHAR(36) PRIMARY KEY, "
                "user_id VARCHAR(36) NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE, "
                "reminder_type VARCHAR(20) NOT NULL, "
                "dispatch_key VARCHAR(80) NOT NULL UNIQUE, "
                "status VARCHAR(20) NOT NULL DEFAULT 'processing', "
                "attempts INTEGER NOT NULL DEFAULT 0, "
                "delivered_count INTEGER NOT NULL DEFAULT 0, "
                "failed_count INTEGER NOT NULL DEFAULT 0, "
                "last_error TEXT, "
                "created_at TIMESTAMP DEFAULT NOW(), "
                "sent_at TIMESTAMP)"
            ))
            conn.execute(text("CREATE INDEX ix_reminder_dispatch_log_user_id ON reminder_dispatch_log (user_id)"))
            conn.execute(text("CREATE INDEX ix_reminder_dispatch_log_reminder_type ON reminder_dispatch_log (reminder_type)"))
            conn.execute(text("CREATE INDEX ix_reminder_dispatch_log_status ON reminder_dispatch_log (status)"))
        conn.commit()


def _applied_migrations(conn) -> set[str]:
    from sqlalchemy import text
    rows = conn.execute(text("SELECT name FROM schema_migrations"))
    return {r[0] for r in rows}


def _mark_done_conn(conn, name: str) -> None:
    from sqlalchemy import text
    if DATABASE_URL.startswith("sqlite"):
        conn.execute(text("INSERT OR IGNORE INTO schema_migrations (name) VALUES (:n)"), {"n": name})
    else:
        conn.execute(text("INSERT INTO schema_migrations (name) VALUES (:n) ON CONFLICT DO NOTHING"), {"n": name})


# Each entry runs at most once. Add new columns as their own named migration —
# do not only append to _migrate_postgres/_migrate_sqlite.
MIGRATIONS: list[tuple[str, Callable[[], None]]] = [
    ("sqlite_schema", _migrate_sqlite),
    ("postgres_schema", _migrate_postgres),
    ("restaurant_delivery_json", _migrate_restaurant_delivery_json),
    ("history_location_context", _migrate_history_location_context),
    ("push_reminders", _migrate_push_reminders),
]


def run_pending_migrations() -> None:
    """Warm boot: one connection, one SELECT, no schema inspection."""
    from sqlalchemy import text
    with engine.connect() as conn:
        conn.execute(text(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(name VARCHAR(100) PRIMARY KEY, "
            "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        ))
        conn.commit()
        applied = _applied_migrations(conn)
        for name, fn in MIGRATIONS:
            if name in applied:
                continue
            fn()
            _mark_done_conn(conn, name)
            conn.commit()
            applied.add(name)


def init_db() -> None:
    """Create tables and apply additive migrations for explicit deploy steps."""
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    run_pending_migrations()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
