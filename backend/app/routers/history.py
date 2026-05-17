from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel
from app.schemas import CookingHistoryCreate, CookingHistoryResponse

router = APIRouter(prefix="/history", tags=["history"])


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
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[CookingHistoryResponse])
def get_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    return (
        db.query(CookingHistoryModel)
        .filter(CookingHistoryModel.user_id == current_user.id)
        .order_by(CookingHistoryModel.timestamp.desc())
        .limit(limit)
        .all()
    )
