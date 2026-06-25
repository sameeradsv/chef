from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
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


def _now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


@router.post("/reminders/process", response_model=ReminderProcessResponse)
def process_reminders(
    reminder_type: Annotated[ReminderType, Query(alias="type")],
    x_cron_secret: Annotated[str | None, Header(alias="X-Cron-Secret")] = None,
    db: Session = Depends(get_db),
):
    expected = os.getenv("REMINDER_CRON_SECRET", "")
    if not expected or x_cron_secret != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")
    result = process_due_reminders(db, reminder_type)
    return ReminderProcessResponse(
        reminder_type=reminder_type,
        due_users=result.due_users,
        claimed=result.claimed,
        sent=result.sent,
        failed=result.failed,
        inactive_subscriptions=result.inactive_subscriptions,
    )
