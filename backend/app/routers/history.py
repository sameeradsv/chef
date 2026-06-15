from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel
from app.schemas import CookingHistoryCreate, CookingHistoryResponse, CookingHistoryUpdate

router = APIRouter(prefix="/history", tags=["history"])

_IST = timezone(timedelta(hours=5, minutes=30))
_UTC = timezone.utc


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Treat a naive datetime as IST and return naive UTC for DB storage."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=_IST)
    return dt.astimezone(_UTC).replace(tzinfo=None)


def _to_ist(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert a naive UTC datetime from DB to an IST-aware datetime for the response."""
    if dt is None:
        return None
    return dt.replace(tzinfo=_UTC).astimezone(_IST)


def _to_response(entry: CookingHistoryModel) -> CookingHistoryResponse:
    return CookingHistoryResponse(
        id=entry.id,
        decision=entry.decision,
        recipe_name=entry.recipe_name,
        cuisine=entry.cuisine,
        timestamp=_to_ist(entry.timestamp),
        satisfaction=entry.satisfaction,
        cost=entry.cost,
        created_at=_to_ist(entry.created_at),
    )


@router.post("", response_model=CookingHistoryResponse, status_code=201)
def log_decision(
    payload: CookingHistoryCreate,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    entry = CookingHistoryModel(
        user_id=current_user.id,
        decision=payload.decision,
        recipe_name=payload.recipe_name,
        cuisine=payload.cuisine,
        satisfaction=payload.satisfaction,
        cost=payload.cost,
        **({"timestamp": _as_utc(payload.timestamp)} if payload.timestamp else {}),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_response(entry)


@router.patch("/{entry_id}", response_model=CookingHistoryResponse)
def update_entry(
    entry_id: str,
    payload: CookingHistoryUpdate,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    entry = (
        db.query(CookingHistoryModel)
        .filter(CookingHistoryModel.id == entry_id, CookingHistoryModel.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, _as_utc(v) if k == "timestamp" else v)
    db.commit()
    db.refresh(entry)
    return _to_response(entry)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    entry = (
        db.query(CookingHistoryModel)
        .filter(CookingHistoryModel.id == entry_id, CookingHistoryModel.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()


@router.get("", response_model=List[CookingHistoryResponse])
def get_history(
    limit: int = Query(20, ge=1, le=100),
    date: Optional[str] = Query(None, description="Filter by date: 'today' or 'YYYY-MM-DD'"),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    _IST_TD = timedelta(hours=5, minutes=30)
    q = db.query(CookingHistoryModel).filter(CookingHistoryModel.user_id == current_user.id)

    if date:
        if date == "today":
            filter_date = (datetime.utcnow() + _IST_TD).date()
        else:
            try:
                filter_date = datetime.strptime(date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="date must be 'today' or 'YYYY-MM-DD'")
        # Convert IST day boundary back to UTC for DB query
        day_start_ist = datetime(filter_date.year, filter_date.month, filter_date.day)
        day_start_utc = day_start_ist - _IST_TD
        day_end_utc   = day_start_utc + timedelta(days=1)
        q = q.filter(
            CookingHistoryModel.timestamp >= day_start_utc,
            CookingHistoryModel.timestamp < day_end_utc,
        )

    from sqlalchemy import func
    sort_col = func.coalesce(CookingHistoryModel.created_at, CookingHistoryModel.timestamp)
    entries = q.order_by(sort_col.desc(), CookingHistoryModel.timestamp.desc()).limit(limit).all()
    return [_to_response(e) for e in entries]
