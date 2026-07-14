import unittest
from datetime import datetime
from unittest.mock import patch

from fastapi import HTTPException

from sqlalchemy import create_engine, select
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app.routers.notifications import _disable_matching_device_subscriptions, _require_reminder_cron_secret
from app import database as database_module
from app.database import Base
from app.models import (
    PushSubscriptionModel,
    ReminderDispatchLogModel,
    UserAccountModel,
    UserReminderSettingsModel,
)
from app.services.reminders import process_due_reminders


class ReminderServiceTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def _user(self, db, user_id="u1"):
        user = UserAccountModel(id=user_id, username=user_id, hashed_passcode="x")
        db.add(user)
        db.add(UserReminderSettingsModel(user_id=user_id, morning_time="11:00", afternoon_time="15:00", evening_time="22:00"))
        db.add(
            PushSubscriptionModel(
                user_id=user_id,
                endpoint=f"https://push.example/{user_id}",
                p256dh="p256dh-key",
                auth="auth-key",
                device_name="test",
                platform="unit",
            )
        )
        db.commit()
        return user

    def test_processes_only_due_reminders(self):
        db = self.Session()
        self._user(db)
        sends = []

        def sender(**kwargs):
            sends.append(kwargs["data"])

        result = process_due_reminders(db, "morning", at_ist=datetime(2026, 6, 25, 11, 0), sender=sender)

        self.assertEqual(result.due_users, 1)
        self.assertEqual(result.claimed, 1)
        self.assertEqual(result.sent, 1)
        self.assertEqual(len(sends), 1)

    def test_dispatch_key_prevents_duplicate_sends(self):
        db = self.Session()
        self._user(db)
        sends = []

        def sender(**kwargs):
            sends.append(kwargs["data"])

        process_due_reminders(db, "morning", at_ist=datetime(2026, 6, 25, 11, 0), sender=sender)
        second = process_due_reminders(db, "morning", at_ist=datetime(2026, 6, 25, 11, 0), sender=sender)

        self.assertEqual(second.due_users, 1)
        self.assertEqual(second.claimed, 0)
        self.assertEqual(len(sends), 1)
        self.assertEqual(db.scalar(select(ReminderDispatchLogModel.status)), "sent")

    def test_invalid_subscription_is_disabled(self):
        class Gone(Exception):
            response = type("Response", (), {"status_code": 410})()

        db = self.Session()
        self._user(db)

        def sender(**kwargs):
            raise Gone("gone")

        result = process_due_reminders(db, "evening", at_ist=datetime(2026, 6, 25, 22, 0), sender=sender)
        subscription = db.scalar(select(PushSubscriptionModel))

        self.assertEqual(result.inactive_subscriptions, 1)
        self.assertFalse(subscription.enabled)

    def test_new_device_subscription_disables_stale_matching_endpoint(self):
        db = self.Session()
        self._user(db)
        db.add(
            PushSubscriptionModel(
                user_id="u1",
                endpoint="https://push.example/u1-new",
                p256dh="p256dh-key-new",
                auth="auth-key-new",
                device_name="test",
                platform="unit",
            )
        )
        db.commit()

        _disable_matching_device_subscriptions(
            db,
            user_id="u1",
            current_endpoint="https://push.example/u1-new",
            device_name="test",
            platform="unit",
            now=datetime(2026, 6, 25, 9, 0),
        )
        db.commit()

        subscriptions = {
            row.endpoint: row.enabled
            for row in db.scalars(select(PushSubscriptionModel).order_by(PushSubscriptionModel.endpoint))
        }

        self.assertFalse(subscriptions["https://push.example/u1"])
        self.assertTrue(subscriptions["https://push.example/u1-new"])


class ReminderCronAuthTest(unittest.TestCase):
    def test_accepts_canopy_style_bearer_secret(self):
        with patch.dict("os.environ", {"REMINDER_CRON_SECRET": "cron-secret"}):
            _require_reminder_cron_secret(authorization="Bearer cron-secret")

    def test_rejects_invalid_bearer_secret(self):
        with patch.dict("os.environ", {"REMINDER_CRON_SECRET": "cron-secret"}):
            with self.assertRaises(HTTPException) as raised:
                _require_reminder_cron_secret(authorization="Bearer wrong")
        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()


def test_migration_updates_only_old_default_reminder_times(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    monkeypatch.setattr(database_module, "engine", engine)
    monkeypatch.setattr(database_module, "DATABASE_URL", "sqlite:///:memory:")

    with engine.connect() as conn:
        conn.execute(text(
            "CREATE TABLE user_reminder_settings ("
            "user_id VARCHAR(36) PRIMARY KEY, "
            "enabled BOOLEAN NOT NULL DEFAULT 1, "
            "morning_time VARCHAR(5) NOT NULL, "
            "afternoon_time VARCHAR(5) NOT NULL, "
            "evening_time VARCHAR(5) NOT NULL, "
            "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
        ))
        conn.execute(text(
            "INSERT INTO user_reminder_settings "
            "(user_id, morning_time, afternoon_time, evening_time) VALUES "
            "('old-defaults', '09:00', '14:00', '20:00'), "
            "('custom', '10:00', '14:00', '20:00')"
        ))
        conn.commit()

    database_module._migrate_default_meal_log_reminder_times()

    with engine.connect() as conn:
        rows = {
            row["user_id"]: (row["morning_time"], row["afternoon_time"], row["evening_time"])
            for row in conn.execute(text("SELECT * FROM user_reminder_settings")).mappings()
        }

    assert rows["old-defaults"] == ("11:00", "15:00", "22:00")
    assert rows["custom"] == ("10:00", "14:00", "20:00")
