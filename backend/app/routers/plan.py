from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import UserAccountModel
from app.services.meal_plan import week_meal_plan

router = APIRouter(prefix="/plan", tags=["plan"])


@router.get("/week")
def get_week_plan(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    return week_meal_plan(db, current_user.id)
