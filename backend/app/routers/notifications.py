from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import PushSubscriptionModel, UserAccountModel, UserReminderSettingsModel
from app.schemas import (
    PushSubscriptionPayload,
    PushSubscriptionResponse,
    PushUnsubscribePayload,
    ReminderProcessResponse,
    ReminderSettingsPayload,
    ReminderSettingsResponse,
    ReminderType,
)
from app.services.reminders import get_or_create_settings, process_due_reminders

router = APIRouter(prefix="/notifications", tags=["notifications"])

REMINDER_TYPES = {"morning", "afternoon", "evening"}


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _cron_secret_from_authorization(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def _require_reminder_cron_secret(authorization: str | None = None) -> None:
    expected = os.getenv("REMINDER_CRON_SECRET", "")
    if not expected:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Reminder cron is not configured")

    token = _cron_secret_from_authorization(authorization)
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reminder processor token")


def _reminder_response(db: Session, reminder_type: ReminderType) -> ReminderProcessResponse:
    result = process_due_reminders(db, reminder_type)
    return ReminderProcessResponse(
        reminder_type=reminder_type,
        due_users=result.due_users,
        claimed=result.claimed,
        sent=result.sent,
        failed=result.failed,
        inactive_subscriptions=result.inactive_subscriptions,
    )


def _canopy_settings_response(row: UserReminderSettingsModel) -> dict[str, Any]:
    return {
        "enabled": row.enabled,
        "times": {
            "morning": row.morning_time,
            "afternoon": row.afternoon_time,
            "evening": row.evening_time,
        },
        "types": {
            "morning": True,
            "afternoon": True,
            "evening": True,
        },
    }


def _validate_reminder_time(value: str) -> str:
    if not isinstance(value, str) or len(value) != 5 or value[2] != ":":
        raise HTTPException(status_code=422, detail="Reminder time must be HH:MM in 24-hour local time")
    hour_text, minute_text = value.split(":")
    if not hour_text.isdigit() or not minute_text.isdigit():
        raise HTTPException(status_code=422, detail="Reminder time must be HH:MM in 24-hour local time")
    hour = int(hour_text)
    minute = int(minute_text)
    if hour > 23 or minute > 59:
        raise HTTPException(status_code=422, detail="Reminder time must be HH:MM in 24-hour local time")
    return value


def _matching_device_query(
    user_id: str,
    device_name: str | None,
    platform: str | None,
):
    if not device_name or not platform:
        return None
    return (
        select(PushSubscriptionModel)
        .where(PushSubscriptionModel.user_id == user_id)
        .where(PushSubscriptionModel.device_name == device_name)
        .where(PushSubscriptionModel.platform == platform)
        .where(PushSubscriptionModel.enabled.is_(True))
    )


def _disable_matching_device_subscriptions(
    db: Session,
    *,
    user_id: str,
    current_endpoint: str,
    device_name: str | None,
    platform: str | None,
    now: datetime,
) -> None:
    query = _matching_device_query(user_id, device_name, platform)
    if query is None:
        return
    for subscription in db.scalars(query.where(PushSubscriptionModel.endpoint != current_endpoint)):
        subscription.enabled = False
        subscription.updated_at = now


@router.get("/vapid-public-key")
def vapid_public_key():
    key = os.getenv("VAPID_PUBLIC_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="VAPID_PUBLIC_KEY is not configured")
    return {"public_key": key}


@router.get("/subscriptions", response_model=list[PushSubscriptionResponse])
def list_subscriptions(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    return list(
        db.scalars(
            select(PushSubscriptionModel)
            .where(PushSubscriptionModel.user_id == current_user.id)
            .where(PushSubscriptionModel.enabled.is_(True))
            .order_by(PushSubscriptionModel.created_at.desc())
        )
    )


@router.post("/subscriptions", response_model=PushSubscriptionResponse, status_code=201)
def subscribe_device(
    payload: PushSubscriptionPayload,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = db.scalar(select(PushSubscriptionModel).where(PushSubscriptionModel.endpoint == payload.endpoint))
    now = _now_naive()
    if row:
        row.user_id = current_user.id
        row.p256dh = payload.keys.p256dh
        row.auth = payload.keys.auth
        row.device_name = payload.device_name
        row.platform = payload.platform
        row.enabled = True
        row.updated_at = now
    else:
        row = PushSubscriptionModel(
            user_id=current_user.id,
            endpoint=payload.endpoint,
            p256dh=payload.keys.p256dh,
            auth=payload.keys.auth,
            device_name=payload.device_name,
            platform=payload.platform,
            enabled=True,
        )
        db.add(row)
    _disable_matching_device_subscriptions(
        db,
        user_id=current_user.id,
        current_endpoint=payload.endpoint,
        device_name=payload.device_name,
        platform=payload.platform,
        now=now,
    )
    get_or_create_settings(db, current_user.id)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/subscriptions", status_code=204)
def unsubscribe_device(
    payload: PushUnsubscribePayload,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = db.scalar(
        select(PushSubscriptionModel)
        .where(PushSubscriptionModel.user_id == current_user.id)
        .where(PushSubscriptionModel.endpoint == payload.endpoint)
    )
    if row:
        row.enabled = False
        row.updated_at = _now_naive()
        _disable_matching_device_subscriptions(
            db,
            user_id=current_user.id,
            current_endpoint=payload.endpoint,
            device_name=payload.device_name,
            platform=payload.platform,
            now=row.updated_at,
        )
        db.commit()


@router.get("/settings", response_model=ReminderSettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = get_or_create_settings(db, current_user.id)
    return ReminderSettingsResponse(
        enabled=row.enabled,
        morning_time=row.morning_time,
        afternoon_time=row.afternoon_time,
        evening_time=row.evening_time,
        updated_at=row.updated_at,
    )


@router.get("/reminder-settings")
def get_canopy_style_reminder_settings(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = get_or_create_settings(db, current_user.id)
    return _canopy_settings_response(row)


@router.put("/settings", response_model=ReminderSettingsResponse)
def update_settings(
    payload: ReminderSettingsPayload,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = db.get(UserReminderSettingsModel, current_user.id)
    if not row:
        row = UserReminderSettingsModel(user_id=current_user.id)
        db.add(row)
    row.enabled = payload.enabled
    row.morning_time = payload.morning_time
    row.afternoon_time = payload.afternoon_time
    row.evening_time = payload.evening_time
    row.updated_at = _now_naive()
    db.commit()
    db.refresh(row)
    return ReminderSettingsResponse(
        enabled=row.enabled,
        morning_time=row.morning_time,
        afternoon_time=row.afternoon_time,
        evening_time=row.evening_time,
        updated_at=row.updated_at,
    )


@router.put("/reminder-settings")
def update_canopy_style_reminder_settings(
    payload: Annotated[dict[str, Any], Body()],
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = db.get(UserReminderSettingsModel, current_user.id)
    if not row:
        row = UserReminderSettingsModel(user_id=current_user.id)
        db.add(row)

    times = payload.get("times") if isinstance(payload.get("times"), dict) else {}
    row.enabled = bool(payload.get("enabled", row.enabled))
    row.morning_time = _validate_reminder_time(times.get("morning", row.morning_time))
    row.afternoon_time = _validate_reminder_time(times.get("afternoon", row.afternoon_time))
    row.evening_time = _validate_reminder_time(times.get("evening", row.evening_time))
    row.updated_at = _now_naive()
    db.commit()
    db.refresh(row)
    return _canopy_settings_response(row)


@router.post("/reminder/{reminder_type}", response_model=ReminderProcessResponse)
def process_canopy_style_reminder(
    reminder_type: str,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    db: Session = Depends(get_db),
):
    if reminder_type not in REMINDER_TYPES:
        raise HTTPException(status_code=404, detail="Unknown reminder type")
    _require_reminder_cron_secret(authorization=authorization)
    return _reminder_response(db, reminder_type)  # type: ignore[arg-type]
