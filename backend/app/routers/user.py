from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import UserAccountModel, UserPreferencesModel, UserStateModel
from app.schemas import UserPreferencesPayload, UserPreferencesResponse, UserProfileResponse, UserStatePayload, UserStateResponse

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


@router.get("/state", response_model=UserStateResponse)
def get_user_state(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = (
        db.query(UserStateModel)
        .filter(UserStateModel.user_id == current_user.id)
        .first()
    )
    if not row:
        return UserStateResponse()
    return UserStateResponse(
        energy_level=row.energy_level,
        time_available_minutes=row.time_available_minutes,
        budget_today=row.budget_today,
        health_priority=row.health_priority,
        craving=row.craving,
        willingness_to_cook=row.willingness_to_cook,
        stress_level=row.stress_level,
    )


@router.get("/preferences", response_model=UserPreferencesResponse)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = (
        db.query(UserPreferencesModel)
        .filter(UserPreferencesModel.user_id == current_user.id)
        .first()
    )
    if not row:
        return UserPreferencesResponse()
    return UserPreferencesResponse(
        favorite_cuisines=[c.strip() for c in (row.favorite_cuisines or "").split(",") if c.strip()],
        spice_level=row.spice_level,
        dietary_restrictions=[r.strip() for r in (row.dietary_restrictions or "").split(",") if r.strip()],
        vegetarian=row.vegetarian if row.vegetarian is not None else True,
        skipped_ingredients=[s.strip() for s in (row.skipped_ingredients or "").split(",") if s.strip()],
        city=row.city or "",
        people_count=row.people_count if row.people_count is not None else 2,
    )


@router.put("/preferences", response_model=UserPreferencesResponse)
def update_preferences(
    payload: UserPreferencesPayload,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    row = (
        db.query(UserPreferencesModel)
        .filter(UserPreferencesModel.user_id == current_user.id)
        .first()
    )
    if not row:
        row = UserPreferencesModel(user_id=current_user.id)
        db.add(row)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return UserPreferencesResponse(
        favorite_cuisines=[c.strip() for c in (row.favorite_cuisines or "").split(",") if c.strip()],
        spice_level=row.spice_level,
        dietary_restrictions=[r.strip() for r in (row.dietary_restrictions or "").split(",") if r.strip()],
        vegetarian=row.vegetarian if row.vegetarian is not None else True,
        skipped_ingredients=[s.strip() for s in (row.skipped_ingredients or "").split(",") if s.strip()],
        city=row.city or "",
        people_count=row.people_count if row.people_count is not None else 2,
    )
