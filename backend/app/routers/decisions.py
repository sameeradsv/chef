from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import IngredientModel, UserAccountModel, UserPreferencesModel, UserStateModel
from app.schemas import (
    CookVsOrderRequest,
    CookVsOrderResponse,
    RecommendMealResponse,
    RestaurantOption,
    UserStatePayload,
)
from app.services.decision_engine import compare_options, recommend_meal
from app.services.freshness import days_until_expiry
from app.services.llm import generate_decision_narrative
from app.services.personalization import get_user_profile
from app.services.recipes import (
    best_restaurant_for_state,
    current_meal_type,
    get_recipe_by_id,
    get_restaurant_by_id,
    recommend_recipes,
)
from app.services.restaurants import best_ai_restaurant, generate_restaurant_suggestions

router = APIRouter(prefix="/decision", tags=["decisions"])


def _diet(db: Session, user_id: str) -> tuple[bool, list[str], list[str], int, list[str], int, str]:
    row = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == user_id).first()
    if not row:
        return True, [], [], 5, [], 2, ""
    veg = row.vegetarian if row.vegetarian is not None else True
    skipped = [s.strip() for s in (row.skipped_ingredients or "").split(",") if s.strip()]
    cuisines = [c.strip() for c in (row.favorite_cuisines or "").split(",") if c.strip()]
    spice = row.spice_level or 5
    restrictions = [d.strip() for d in (row.dietary_restrictions or "").split(",") if d.strip()]
    people = row.people_count if row.people_count is not None else 2
    city = row.city or ""
    return veg, skipped, cuisines, spice, restrictions, people, city


def _state(db: Session, user_id: str) -> UserStatePayload:
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
    current_user: UserAccountModel = Depends(get_current_user),
):
    body = body or CookVsOrderRequest()
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == current_user.id).all()
    state = _state(db, current_user.id)
    profile = get_user_profile(current_user.id, db)
    vegetarian, skipped, fav_cuisines, spice_level, diet_restrictions, pref_people, city = _diet(db, current_user.id)
    people_count = body.people_count if body.people_count is not None else pref_people
    meal_type = current_meal_type()

    if body.recipe_id:
        recipe = get_recipe_by_id(body.recipe_id, pantry)
    else:
        recs = recommend_recipes(
            pantry, state, 1,
            vegetarian=vegetarian,
            skipped_ingredients=skipped,
            favorite_cuisines=fav_cuisines,
            spice_level=spice_level,
            dietary_restrictions=diet_restrictions,
            meal_type=meal_type,
        )
        recipe = recs[0] if recs else get_recipe_by_id("r-dal-tadka", pantry)
    if not recipe:
        from app.services.recipes import load_recipes
        raw = load_recipes()[0]
        recipe = get_recipe_by_id(raw["id"], pantry)

    if body.restaurant_id:
        rest_raw = get_restaurant_by_id(body.restaurant_id)
    elif city:
        suggestions = generate_restaurant_suggestions(
            city=city,
            cuisines=fav_cuisines,
            budget=state.budget_today,
            vegetarian=vegetarian,
            craving=state.craving,
        )
        rest_raw = best_ai_restaurant(suggestions, state.craving, state.budget_today) or best_restaurant_for_state(state, vegetarian=vegetarian)
    else:
        rest_raw = best_restaurant_for_state(state, vegetarian=vegetarian)
    restaurant = _restaurant_dto(rest_raw)

    result = compare_options(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
        profile,
        people_count,
    )
    result.narrative = generate_decision_narrative(result)
    return result


@router.post("/recommend-meal", response_model=RecommendMealResponse)
def recommend_meal_endpoint(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == current_user.id).all()
    state = _state(db, current_user.id)
    profile = get_user_profile(current_user.id, db)
    vegetarian, skipped, fav_cuisines, spice_level, diet_restrictions, pref_people, city = _diet(db, current_user.id)
    meal_type = current_meal_type()
    recs = recommend_recipes(
        pantry, state, 1,
        vegetarian=vegetarian,
        skipped_ingredients=skipped,
        favorite_cuisines=fav_cuisines,
        spice_level=spice_level,
        dietary_restrictions=diet_restrictions,
        meal_type=meal_type,
    )
    recipe = recs[0] if recs else get_recipe_by_id("r-dal-tadka", pantry)
    if city:
        suggestions = generate_restaurant_suggestions(
            city=city,
            cuisines=fav_cuisines,
            budget=state.budget_today,
            vegetarian=vegetarian,
            craving=state.craving,
        )
        rest_raw = best_ai_restaurant(suggestions, state.craving, state.budget_today) or best_restaurant_for_state(state, vegetarian=vegetarian)
    else:
        rest_raw = best_restaurant_for_state(state, vegetarian=vegetarian)
    restaurant = _restaurant_dto(rest_raw)
    result = recommend_meal(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
        profile,
        pref_people,
    )
    result.narrative = generate_decision_narrative(result)
    return result
