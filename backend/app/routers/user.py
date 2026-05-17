from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import UserPreferencesModel, UserStateModel
from app.schemas import UserPreferencesResponse, UserStatePayload, UserStateResponse

router = APIRouter(prefix="/user", tags=["user"])


@router.post("/state", response_model=UserStateResponse)
def set_user_state(payload: UserStatePayload, db: Session = Depends(get_db)):
    row = db.query(UserStateModel).filter(UserStateModel.id == 1).first()
    if not row:
        row = UserStateModel(id=1)
        db.add(row)
    for field, value in payload.model_dump().items():
        setattr(row, field, value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return UserStateResponse(
        energy_level=row.energy_level,
        time_available_minutes=row.time_available_minutes,
        budget_today=row.budget_today,
        health_priority=row.health_priority,
        craving=row.craving,
        willingness_to_cook=row.willingness_to_cook,
        stress_level=row.stress_level,
        updated_at=row.updated_at,
    )


@router.get("/preferences", response_model=UserPreferencesResponse)
def get_preferences(db: Session = Depends(get_db)):
    row = db.query(UserPreferencesModel).filter(UserPreferencesModel.id == 1).first()
    if not row:
        return UserPreferencesResponse()
    cuisines = [c.strip() for c in row.favorite_cuisines.split(",") if c.strip()]
    restrictions = [
        r.strip() for r in row.dietary_restrictions.split(",") if r.strip()
    ]
    return UserPreferencesResponse(
        favorite_cuisines=cuisines,
        spice_level=row.spice_level,
        dietary_restrictions=restrictions,
    )
