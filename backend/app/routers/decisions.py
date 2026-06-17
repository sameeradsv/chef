from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

# Simple in-process TTL cache for decision scoring (deterministic given same inputs).
_DCACHE: dict[str, tuple[float, Any]] = {}
_DCACHE_TTL = 1800  # seconds (30 min; cache key includes pantry IDs so invalidates on pantry changes)

def _dcache_key(*parts: object) -> str:
    return hashlib.md5(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()

def _dcache_get(key: str) -> Any | None:
    entry = _DCACHE.get(key)
    if entry and time.time() - entry[0] < _DCACHE_TTL:
        return entry[1]
    _DCACHE.pop(key, None)
    return None

def _dcache_set(key: str, value: Any) -> None:
    if len(_DCACHE) > 500:
        oldest = min(_DCACHE, key=lambda k: _DCACHE[k][0])
        _DCACHE.pop(oldest, None)
    _DCACHE[key] = (time.time(), value)

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
    current_meal_type,
    get_recipe_by_id,
    recommend_recipes,
)
from app.services.restaurants import pick_restaurants_for_decision

router = APIRouter(prefix="/decision", tags=["decisions"])


def _diet(db: Session, user_id: str) -> tuple[bool, list[str], list[str], int, list[str], int, str, int]:
    row = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == user_id).first()
    if not row:
        return True, [], [], 5, [], 2, "", 3
    veg = row.vegetarian if row.vegetarian is not None else True
    skipped = [s.strip() for s in (row.skipped_ingredients or "").split(",") if s.strip()]
    cuisines = [c.strip() for c in (row.favorite_cuisines or "").split(",") if c.strip()]
    spice = row.spice_level or 5
    restrictions = [d.strip() for d in (row.dietary_restrictions or "").split(",") if d.strip()]
    people = row.people_count if row.people_count is not None else 2
    city = row.city or ""
    skill = row.cooking_skill if row.cooking_skill is not None else 3
    return veg, skipped, cuisines, spice, restrictions, people, city, skill


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


def _state_with_overrides(base: UserStatePayload, body: CookVsOrderRequest) -> UserStatePayload:
    data = base.model_dump()
    for field in UserStatePayload.model_fields:
        override = getattr(body, field, None)
        if override is not None:
            data[field] = override
    return UserStatePayload(**data)


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
    state = _state_with_overrides(_state(db, current_user.id), body)

    ckey = _dcache_key(
        current_user.id, body.recipe_id, body.restaurant_id, body.people_count,
        sorted(p.id for p in pantry), state.energy_level, state.willingness_to_cook,
        state.craving, state.budget_today, state.time_available_minutes,
    )
    if cached := _dcache_get(ckey):
        return cached
    profile = get_user_profile(current_user.id, db)
    vegetarian, skipped, fav_cuisines, spice_level, diet_restrictions, pref_people, city, cooking_skill = _diet(db, current_user.id)
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
        primary_raw, order_raw = pick_restaurants_for_decision(
            db,
            current_user.id,
            state=state,
            vegetarian=vegetarian,
            city=city,
            cuisines=fav_cuisines,
            restaurant_id=body.restaurant_id,
        )
    else:
        primary_raw, order_raw = pick_restaurants_for_decision(
            db,
            current_user.id,
            state=state,
            vegetarian=vegetarian,
            city=city,
            cuisines=fav_cuisines,
        )
    restaurant = _restaurant_dto(primary_raw)
    order_restaurant = _restaurant_dto(order_raw) if order_raw else None

    result = compare_options(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
        profile,
        people_count,
        cooking_skill,
        order_restaurant=order_restaurant,
    )
    result.narrative = generate_decision_narrative(result)
    _dcache_set(ckey, result)
    return result


@router.post("/recommend-meal", response_model=RecommendMealResponse)
def recommend_meal_endpoint(
    fast: bool = Query(False, description="Skip Groq narrative and AI restaurant lookup"),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == current_user.id).all()
    state = _state(db, current_user.id)

    rkey = _dcache_key(
        current_user.id, "recommend", sorted(p.id for p in pantry),
        state.energy_level, state.craving, state.budget_today, state.time_available_minutes,
        fast,
    )
    if cached := _dcache_get(rkey):
        return cached

    profile = get_user_profile(current_user.id, db)
    vegetarian, skipped, fav_cuisines, spice_level, diet_restrictions, pref_people, city, cooking_skill = _diet(db, current_user.id)
    meal_type = current_meal_type()
    recs = recommend_recipes(
        pantry, state, 1,
        vegetarian=vegetarian,
        skipped_ingredients=skipped,
        favorite_cuisines=fav_cuisines,
        spice_level=spice_level,
        dietary_restrictions=diet_restrictions,
        meal_type=meal_type,
        prefer_groq=True,
        fast=fast,
    )
    recipe = recs[0] if recs else get_recipe_by_id("r-dal-tadka", pantry)
    primary_raw, order_raw = pick_restaurants_for_decision(
        db,
        current_user.id,
        state=state,
        vegetarian=vegetarian,
        city=city,
        cuisines=fav_cuisines,
        skip_ai=fast,
    )
    restaurant = _restaurant_dto(primary_raw)
    order_restaurant = _restaurant_dto(order_raw) if order_raw else None
    result = recommend_meal(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
        profile,
        pref_people,
        cooking_skill,
        order_restaurant=order_restaurant,
    )
    if not fast:
        result.narrative = generate_decision_narrative(result)
    _dcache_set(rkey, result)
    return result


@router.get("/predict", response_model=dict)
def predict_tonight(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    from app.services.predictive import predict_meal_tendency

    return predict_meal_tendency(db, current_user.id)


@router.get("/cost-insights", response_model=dict)
def cost_insights_route(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    from app.services.cost_insights import cost_insights

    return cost_insights(db, current_user.id)
