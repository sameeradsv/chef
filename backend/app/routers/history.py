from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel
from app.schemas import (
    CookingHistoryCreate,
    CookingHistoryResponse,
    CookingHistoryUpdate,
    HistoryPageResponse,
    HistorySummary,
)
from app.tz_utils import ist_day_bounds, ist_today

router = APIRouter(prefix="/history", tags=["history"])

_IST_TD = timedelta(hours=5, minutes=30)


def _to_response(entry: CookingHistoryModel) -> CookingHistoryResponse:
    return CookingHistoryResponse.model_validate(entry)


def _apply_date_filters(q, date: Optional[str], from_date: Optional[str], to_date: Optional[str]):
    if date:
        if date == "today":
            filter_date = ist_today()
            day_start_utc = datetime(filter_date.year, filter_date.month, filter_date.day) - _IST_TD
            day_end_utc = day_start_utc + timedelta(days=1)
        else:
            day_start_utc, day_end_utc = ist_day_bounds(date)
        q = q.filter(
            CookingHistoryModel.timestamp >= day_start_utc,
            CookingHistoryModel.timestamp < day_end_utc,
        )
    if from_date:
        day_start_utc, _ = ist_day_bounds(from_date)
        q = q.filter(CookingHistoryModel.timestamp >= day_start_utc)
    if to_date:
        _, day_end_utc = ist_day_bounds(to_date)
        q = q.filter(CookingHistoryModel.timestamp < day_end_utc)
    return q


def _compute_summary(q) -> HistorySummary:
    total, total_spent, cook, order, eat_out = q.with_entities(
        func.count(CookingHistoryModel.id),
        func.coalesce(func.sum(CookingHistoryModel.cost), 0.0),
        func.sum(case((CookingHistoryModel.decision == "cook", 1), else_=0)),
        func.sum(case((CookingHistoryModel.decision == "order", 1), else_=0)),
        func.sum(case((CookingHistoryModel.decision == "eat_out", 1), else_=0)),
    ).one()
    return HistorySummary(
        total=int(total or 0),
        total_spent=float(total_spent or 0),
        cook=int(cook or 0),
        order=int(order or 0),
        eat_out=int(eat_out or 0),
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
        restaurant_name=payload.restaurant_name,
        cuisine=payload.cuisine,
        satisfaction=payload.satisfaction,
        cost=payload.cost,
        **({"timestamp": payload.timestamp} if payload.timestamp else {}),
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
        setattr(entry, k, v)
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


@router.get("")
def get_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    date: Optional[str] = Query(None, description="Filter by date: 'today' or 'YYYY-MM-DD'"),
    from_date: Optional[str] = Query(None, description="Inclusive IST start date YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="Inclusive IST end date YYYY-MM-DD"),
    include_summary: bool = Query(False, description="Return paginated payload with summary stats"),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    q = db.query(CookingHistoryModel).filter(CookingHistoryModel.user_id == current_user.id)
    q = _apply_date_filters(q, date, from_date, to_date)

    total = q.count()
    summary = _compute_summary(q) if include_summary else None

    sort_col = func.coalesce(CookingHistoryModel.created_at, CookingHistoryModel.timestamp)
    entries = (
        q.order_by(sort_col.desc(), CookingHistoryModel.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    items = [_to_response(e) for e in entries]

    if include_summary:
        return HistoryPageResponse(
            items=items,
            total=total,
            offset=offset,
            limit=limit,
            summary=summary,
        )
    return items
