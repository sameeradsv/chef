from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import IngredientModel, UserStateModel
from app.schemas import RecipeResponse, UserStatePayload
from app.services.recipes import get_recipe_by_id, recommend_recipes, search_recipes

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _get_pantry(db: Session) -> list:
    return db.query(IngredientModel).all()


def _get_state(db: Session) -> UserStatePayload:
    row = db.query(UserStateModel).filter(UserStateModel.id == 1).first()
    if not row:
        return UserStatePayload()
    return UserStatePayload(
        energy_level=row.energy_level,
        time_available_minutes=row.time_available_minutes,
        budget_today=row.budget_today,
        health_priority=row.health_priority,
        craving=row.craving,
        willingness_to_cook=row.willingness_to_cook,
        stress_level=row.stress_level,
    )


@router.get("/recommend", response_model=list[RecipeResponse])
def recommend(
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    pantry = _get_pantry(db)
    state = _get_state(db)
    return recommend_recipes(pantry, state, limit)


@router.get("/search", response_model=list[RecipeResponse])
def search(
    q: str = Query("", alias="q"),
    cuisine: str | None = None,
    max_time: int | None = None,
    db: Session = Depends(get_db),
):
    pantry = _get_pantry(db)
    return search_recipes(q, cuisine, max_time, pantry)


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(recipe_id: str, db: Session = Depends(get_db)):
    pantry = _get_pantry(db)
    recipe = get_recipe_by_id(recipe_id, pantry)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe
