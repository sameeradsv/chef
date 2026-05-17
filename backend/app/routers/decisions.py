from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import IngredientModel, UserStateModel
from app.schemas import (
    CookVsOrderRequest,
    CookVsOrderResponse,
    RecommendMealResponse,
    RestaurantOption,
    UserStatePayload,
)
from app.services.decision_engine import compare_options, recommend_meal
from app.services.freshness import days_until_expiry
from app.services.recipes import (
    best_restaurant_for_state,
    get_recipe_by_id,
    get_restaurant_by_id,
    recommend_recipes,
)

router = APIRouter(prefix="/decision", tags=["decisions"])


def _state(db: Session) -> UserStatePayload:
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


def _expiring_names(pantry: list) -> list[str]:
    names = []
    for p in pantry:
        d = days_until_expiry(p.expiry_date)
        if d is not None and d <= 3:
            names.append(p.name)
    return names


def _restaurant_dto(raw: dict) -> RestaurantOption:
    return RestaurantOption(**raw)


@router.post("/cook-vs-order", response_model=CookVsOrderResponse)
def cook_vs_order(
    body: CookVsOrderRequest | None = None,
    db: Session = Depends(get_db),
):
    body = body or CookVsOrderRequest()
    pantry = db.query(IngredientModel).all()
    state = _state(db)

    if body.recipe_id:
        recipe = get_recipe_by_id(body.recipe_id, pantry)
    else:
        recs = recommend_recipes(pantry, state, 1)
        recipe = recs[0] if recs else get_recipe_by_id("r-paneer-bhurji", pantry)
    if not recipe:
        from app.services.recipes import load_recipes

        raw = load_recipes()[0]
        recipe = get_recipe_by_id(raw["id"], pantry)

    if body.restaurant_id:
        rest_raw = get_restaurant_by_id(body.restaurant_id)
    else:
        rest_raw = best_restaurant_for_state(state)
    restaurant = _restaurant_dto(rest_raw)

    return compare_options(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
    )


@router.post("/recommend-meal", response_model=RecommendMealResponse)
def recommend_meal_endpoint(db: Session = Depends(get_db)):
    pantry = db.query(IngredientModel).all()
    state = _state(db)
    recs = recommend_recipes(pantry, state, 1)
    recipe = recs[0] if recs else get_recipe_by_id("r-paneer-bhurji", pantry)
    rest_raw = best_restaurant_for_state(state)
    restaurant = _restaurant_dto(rest_raw)
    return recommend_meal(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
    )
