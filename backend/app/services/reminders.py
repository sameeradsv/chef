from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    PushSubscriptionModel,
    ReminderDispatchLogModel,
    UserAccountModel,
    UserReminderSettingsModel,
)
from app.tz_utils import IST_TD

ReminderType = Literal["morning", "afternoon", "evening"]

REMINDER_COPY: dict[ReminderType, tuple[str, str]] = {
    "morning": ("Plan breakfast", "Take one minute to decide what your kitchen can do for you."),
    "afternoon": ("Lunch check-in", "Log lunch or pick a practical option before energy dips."),
    "evening": ("Dinner decision", "Use what is fresh, or make an honest call to order."),
}

log = logging.getLogger(__name__)


@dataclass
class PushResult:
    delivered: int = 0
    failed: int = 0
    inactive: int = 0
    last_error: str | None = None


@dataclass
class ProcessResult:
    due_users: int = 0
    claimed: int = 0
    sent: int = 0
    failed: int = 0
    inactive_subscriptions: int = 0


def now_utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now_ist() -> datetime:
    return now_utc_naive() + IST_TD


def get_or_create_settings(db: Session, user_id: str) -> UserReminderSettingsModel:
    row = db.get(UserReminderSettingsModel, user_id)
    if not row:
        row = UserReminderSettingsModel(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def setting_time(row: UserReminderSettingsModel, reminder_type: ReminderType) -> str:
    return {
        "morning": row.morning_time,
        "afternoon": row.afternoon_time,
        "evening": row.evening_time,
    }[reminder_type]


def due_users(db: Session, reminder_type: ReminderType, at_ist: datetime | None = None) -> list[UserAccountModel]:
    current = at_ist or now_ist()
    hhmm = current.strftime("%H:%M")
    time_column = {
        "morning": UserReminderSettingsModel.morning_time,
        "afternoon": UserReminderSettingsModel.afternoon_time,
        "evening": UserReminderSettingsModel.evening_time,
    }[reminder_type]

    return list(
        db.scalars(
            select(UserAccountModel)
            .join(UserReminderSettingsModel, UserReminderSettingsModel.user_id == UserAccountModel.id)
            .join(PushSubscriptionModel, PushSubscriptionModel.user_id == UserAccountModel.id)
            .where(UserReminderSettingsModel.enabled.is_(True))
            .where(time_column == hhmm)
            .where(PushSubscriptionModel.enabled.is_(True))
            .distinct()
        )
    )


def claim_dispatch(
    db: Session,
    user_id: str,
    reminder_type: ReminderType,
    at_ist: datetime | None = None,
) -> ReminderDispatchLogModel | None:
    current = at_ist or now_ist()
    dispatch_key = f"{current.date().isoformat()}:{user_id}:{reminder_type}"
    row = ReminderDispatchLogModel(
        user_id=user_id,
        reminder_type=reminder_type,
        dispatch_key=dispatch_key,
        status="processing",
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    db.refresh(row)
    return row


def mark_dispatch_done(db: Session, row: ReminderDispatchLogModel, result: PushResult) -> None:
    row.attempts += 1
    row.delivered_count = result.delivered
    row.failed_count = result.failed
    row.last_error = result.last_error
    row.status = "sent" if result.delivered > 0 and result.failed == 0 else "failed"
    row.sent_at = now_utc_naive() if result.delivered > 0 else None
    db.commit()


def _webpush_sender():
    from pywebpush import WebPushException, webpush

    return webpush, WebPushException


def _subscription_payload(subscription: PushSubscriptionModel) -> dict:
    return {
        "endpoint": subscription.endpoint,
        "keys": {
            "p256dh": subscription.p256dh,
            "auth": subscription.auth,
        },
    }


def _is_gone(exc: Exception, web_push_exception: type[Exception]) -> bool:
    response = getattr(exc, "response", None)
    status_code = getattr(response, "status_code", None)
    return isinstance(exc, web_push_exception) and status_code in {404, 410}


def send_user_reminder(
    db: Session,
    user_id: str,
    reminder_type: ReminderType,
    sender: Callable[..., object] | None = None,
    retries: int = 1,
) -> PushResult:
    vapid_private_key = os.getenv("VAPID_PRIVATE_KEY", "")
    vapid_subject = os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")
    if not vapid_private_key and sender is None:
        raise RuntimeError("VAPID_PRIVATE_KEY is not configured")

    subscriptions = list(
        db.scalars(
            select(PushSubscriptionModel)
            .where(PushSubscriptionModel.user_id == user_id)
            .where(PushSubscriptionModel.enabled.is_(True))
        )
    )
    if not subscriptions:
        return PushResult()

    web_push_exception: type[Exception] = Exception
    if sender is None:
        sender, web_push_exception = _webpush_sender()

    title, body = REMINDER_COPY[reminder_type]
    payload = json.dumps(
        {
            "type": "chef-reminder",
            "reminderType": reminder_type,
            "title": title,
            "body": body,
            "url": "/decision",
            "tag": f"chef-{reminder_type}-reminder",
        }
    )
    result = PushResult()

    for subscription in subscriptions:
        for attempt in range(retries + 1):
            try:
                sender(
                    subscription_info=_subscription_payload(subscription),
                    data=payload,
                    vapid_private_key=vapid_private_key,
                    vapid_claims={"sub": vapid_subject},
                    ttl=3600,
                )
                result.delivered += 1
                break
            except Exception as exc:
                result.last_error = str(exc)
                if _is_gone(exc, web_push_exception):
                    subscription.enabled = False
                    result.inactive += 1
                    result.failed += 1
                    log.info("Disabled invalid push subscription %s", subscription.id)
                    break
                if attempt >= retries:
                    result.failed += 1
                    log.warning("Push send failed for subscription %s: %s", subscription.id, exc)
                else:
                    time.sleep(0.2 * (attempt + 1))

    db.commit()
    return result


def process_due_reminders(
    db: Session,
    reminder_type: ReminderType,
    at_ist: datetime | None = None,
    sender: Callable[..., object] | None = None,
) -> ProcessResult:
    users = due_users(db, reminder_type, at_ist=at_ist)
    summary = ProcessResult(due_users=len(users))
    for user in users:
        dispatch = claim_dispatch(db, user.id, reminder_type, at_ist=at_ist)
        if dispatch is None:
            continue
        summary.claimed += 1
        try:
            push_result = send_user_reminder(db, user.id, reminder_type, sender=sender)
        except Exception as exc:
            push_result = PushResult(failed=1, last_error=str(exc))
            log.exception("Reminder processing failed for user %s", user.id)
        mark_dispatch_done(db, dispatch, push_result)
        summary.sent += push_result.delivered
        summary.failed += push_result.failed
        summary.inactive_subscriptions += push_result.inactive
    return summary
