from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import UserAccountModel, UserPreferencesModel, UserStateModel
from app.schemas import UserPreferencesResponse, UserProfileResponse, UserStatePayload, UserStateResponse

router = APIRouter(prefix="/user", tags=["user"])


@router.post("/state", response_model=UserStateResponse)
def set_user_state(
    payload: UserStatePayload,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = (
        db.query(UserStateModel)
        .filter(UserStateModel.user_id == current_user.id)
        .first()
    )
    if not row:
        row = UserStateModel(user_id=current_user.id)
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


@router.get("/preferences", response_model=UserProfileResponse)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    from app.services.personalization import get_user_profile
    return get_user_profile(current_user.id, db)
