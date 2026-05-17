from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import IngredientModel, UserAccountModel, UserStateModel
from app.schemas import RecipeResponse, UserStatePayload
from app.services.mealdb import search_mealdb
from app.services.recipes import get_recipe_by_id, recommend_recipes, search_recipes

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _get_pantry(db: Session, user_id: str) -> list:
    return db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()


def _get_state(db: Session, user_id: str) -> UserStatePayload:
    row = (
        db.query(UserStateModel)
        .filter(UserStateModel.user_id == user_id)
        .first()
    )
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
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = _get_pantry(db, current_user.id)
    state = _get_state(db, current_user.id)
    return recommend_recipes(pantry, state, limit)


@router.get("/search", response_model=list[RecipeResponse])
def search(
    q: str = Query("", alias="q"),
    cuisine: str | None = None,
    max_time: int | None = None,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = _get_pantry(db, current_user.id)
    # Multi-keyword: split on whitespace, each token must appear in haystack
    tokens = [t.strip() for t in q.split() if t.strip()]
    seed_results = search_recipes(tokens, cuisine, max_time, pantry)

    # Try TheMealDB for live results if there's a query
    if q.strip():
        live = search_mealdb(q.strip(), pantry)
        seen_names = {r.name.lower() for r in seed_results}
        for r in live:
            if r.name.lower() not in seen_names:
                seed_results.append(r)
                seen_names.add(r.name.lower())

    return seed_results


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: str,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = _get_pantry(db, current_user.id)
    recipe = get_recipe_by_id(recipe_id, pantry)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe
