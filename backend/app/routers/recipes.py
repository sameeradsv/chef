from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, IngredientModel, UserAccountModel, UserPreferencesModel, UserStateModel
from app.schemas import RecipeResponse, UserPreferencesResponse, UserStatePayload
from app.services.mealdb import generate_recipes
from app.services.personalization import get_user_profile
from app.services.recipes import (
    _passes_diet_response,
    _rank_recipe_responses,
    current_meal_type,
    get_recipe_by_id,
    recommend_recipes,
    search_recipes,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _get_pantry(db: Session, user_id: str) -> list:
    return db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()


def _get_state(db: Session, user_id: str) -> UserStatePayload:
    row = db.query(UserStateModel).filter(UserStateModel.user_id == user_id).first()
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


def _get_prefs(db: Session, user_id: str) -> UserPreferencesResponse:
    row = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == user_id).first()
    if not row:
        return UserPreferencesResponse()
    return UserPreferencesResponse(
        favorite_cuisines=[c.strip() for c in (row.favorite_cuisines or "").split(",") if c.strip()],
        spice_level=row.spice_level,
        dietary_restrictions=[d.strip() for d in (row.dietary_restrictions or "").split(",") if d.strip()],
        vegetarian=row.vegetarian if row.vegetarian is not None else True,
        skipped_ingredients=[s.strip() for s in (row.skipped_ingredients or "").split(",") if s.strip()],
        city=row.city or "",
    )


def _history_context(db: Session, user_id: str) -> tuple[list[str], dict[str, float]]:
    history_entries = (
        db.query(CookingHistoryModel)
        .filter(CookingHistoryModel.user_id == user_id)
        .order_by(CookingHistoryModel.timestamp.desc())
        .limit(50)
        .all()
    )
    recent_meal_names = [h.recipe_name for h in history_entries[:15] if h.recipe_name]
    sat_buckets: dict[str, list[float]] = {}
    for h in history_entries:
        if h.recipe_name and h.satisfaction is not None:
            sat_buckets.setdefault(h.recipe_name.lower(), []).append(float(h.satisfaction))
    satisfaction_by_name = {name: sum(vals) / len(vals) for name, vals in sat_buckets.items()}
    return recent_meal_names, satisfaction_by_name


@router.get("/suggest", response_model=dict)
def suggest(
    meal_type: str = Query("dinner"),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    from app.services.llm import generate_meal_suggestion
    pantry = _get_pantry(db, current_user.id)
    state = _get_state(db, current_user.id)
    prefs = _get_prefs(db, current_user.id)
    pantry_names = [getattr(p, "name", "") for p in pantry if getattr(p, "name", "")]
    suggestion = generate_meal_suggestion(
        meal_type,
        pantry_names,
        state.energy_level,
        vegetarian=prefs.vegetarian,
        dietary_restrictions=prefs.dietary_restrictions,
    )
    return {"suggestion": suggestion}


@router.get("/recommend", response_model=list[RecipeResponse])
def recommend(
    limit: int = Query(5, ge=1, le=20),
    meal_type: str | None = Query(None),
    fast: bool = Query(False, description="Use faster Groq model (llama-3.1-8b-instant)"),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = _get_pantry(db, current_user.id)
    state = _get_state(db, current_user.id)
    prefs = _get_prefs(db, current_user.id)
    effective_meal_type = meal_type or current_meal_type()
    recent_meal_names, satisfaction_by_name = _history_context(db, current_user.id)
    profile = get_user_profile(current_user.id, db)
    effective_cuisines = profile.preferred_cuisines or prefs.favorite_cuisines

    return recommend_recipes(
        pantry, state, limit,
        vegetarian=prefs.vegetarian,
        skipped_ingredients=prefs.skipped_ingredients,
        favorite_cuisines=effective_cuisines,
        spice_level=prefs.spice_level,
        dietary_restrictions=prefs.dietary_restrictions,
        meal_type=effective_meal_type,
        recent_meal_names=recent_meal_names,
        satisfaction_by_name=satisfaction_by_name or None,
        prefer_groq=True,
        fast=fast,
    )


@router.get("/search", response_model=list[RecipeResponse])
def search(
    q: str = Query("", alias="q"),
    cuisine: str | None = None,
    max_time: int | None = None,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    pantry = _get_pantry(db, current_user.id)
    prefs = _get_prefs(db, current_user.id)
    state = _get_state(db, current_user.id)
    skipped = {s.lower() for s in prefs.skipped_ingredients}
    dr_set = {d.lower() for d in prefs.dietary_restrictions}
    tokens = [t.strip() for t in q.split() if t.strip()]

    results: list[RecipeResponse] = []
    seen_names: set[str] = set()

    if q.strip():
        generated = generate_recipes(
            query=q.strip(),
            pantry=pantry,
            spice_level=prefs.spice_level,
            dietary_restrictions=prefs.dietary_restrictions or None,
            vegetarian=prefs.vegetarian,
            count=6,
        )
        for r in generated:
            if r.name.lower() not in seen_names and _passes_diet_response(r, prefs.vegetarian, skipped, dr_set):
                results.append(r)
                seen_names.add(r.name.lower())

    seed_results = search_recipes(
        tokens, cuisine, max_time, pantry,
        vegetarian=prefs.vegetarian,
        skipped_ingredients=prefs.skipped_ingredients,
    )
    for r in seed_results:
        if r.name.lower() not in seen_names:
            results.append(r)
            seen_names.add(r.name.lower())

    if results:
        from app.services.groq_search import groq_rerank_recipes

        if q.strip():
            results = groq_rerank_recipes(q.strip(), results, limit=12)
        ranked = _rank_recipe_responses(results, state, spice_level=prefs.spice_level)
        return ranked

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
