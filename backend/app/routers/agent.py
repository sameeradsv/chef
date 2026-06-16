from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth_utils import get_user_for_token
from app.database import get_db
from app.dependencies import optional_user
from app.models import (
    CookingHistoryModel,
    IngredientModel,
    UserAccountModel,
    UserPreferencesModel,
    UserStateModel,
)
from app.schemas import CookingHistoryCreate, UserStatePayload
from app.services.decision_engine import compare_options
from app.services.freshness import days_until_expiry
from app.services.llm import generate_decision_narrative
from app.services.personalization import get_user_profile
from app.services.recipes import (
    current_meal_type,
    get_recipe_by_id,
    recommend_recipes,
)
from app.services.restaurants import pick_restaurant_for_user
from app.tz_utils import current_meal_day, ist_today, meal_day_bounds

router = APIRouter(prefix="/agent", tags=["agent"])

_TOOLS = [
    {
        "name": "get_meal_recommendation",
        "description": (
            "Fetch meal/recipe recommendations based on the user's pantry, "
            "energy level, time available, and dietary preferences."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Number of recommendations (1–5, default 3)",
                }
            },
        },
    },
    {
        "name": "get_cook_vs_order",
        "description": (
            "Compare cooking at home vs ordering food given current energy, time, "
            "budget, and pantry state. Returns a recommendation with reasoning."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_food_log",
        "description": (
            "Fetch the user's food/meal log for a given day. "
            "Returns decision type, dish name, cuisine, and satisfaction."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Date to fetch: 'today' (default) or 'YYYY-MM-DD'",
                }
            },
        },
    },
    {
        "name": "log_meal",
        "description": "Log a meal the user ate, cooked, or ordered.",
        "input_schema": {
            "type": "object",
            "properties": {
                "decision": {
                    "type": "string",
                    "enum": ["cook", "order", "eat_out"],
                    "description": "How the meal was obtained",
                },
                "recipe_name": {
                    "type": "string",
                    "description": "Name of the dish or meal",
                },
                "cuisine": {
                    "type": "string",
                    "description": "Cuisine type (e.g. Italian, Indian, Japanese)",
                },
                "satisfaction": {
                    "type": "integer",
                    "description": "Satisfaction rating 1–5",
                },
                "timestamp": {
                    "type": "string",
                    "description": "ISO 8601 datetime when the meal occurred (IST)",
                },
            },
            "required": ["decision"],
        },
    },
]


class AgentChatRequest(BaseModel):
    messages: list[dict]
    model: str = "llama-3.3-70b-versatile"
    sibling_token: Optional[str] = None


def _user_state(db: Session, user_id: str) -> UserStatePayload:
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


def _expiring_names(pantry: list[IngredientModel]) -> list[str]:
    names = []
    for p in pantry:
        d = days_until_expiry(p.expiry_date)
        if d is not None and d <= 3:
            names.append(p.name)
    return names


def _build_system_prompt(db: Session, user_id: str) -> str:
    today = ist_today().strftime("%B %d, %Y")
    state = _user_state(db, user_id)
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()
    expiring = _expiring_names(pantry)
    vegetarian, skipped, cuisines, _, restrictions, _, city, _ = _diet(db, user_id)

    lines = [
        f"You are Chef, a kitchen decision assistant. Today is {today} (IST).",
        "Help the user decide what to cook, whether to order, and log meals.",
        "Use tools for live recommendations, cook-vs-order comparisons, food logs, and logging meals.",
        "Be concise, honest about tradeoffs (cost, effort, health, waste), and never invent pantry items.",
        "",
        "## Current context",
        f"- Energy: {state.energy_level}/10 · Time available: {state.time_available_minutes} min",
        f"- Budget today: ₹{state.budget_today:.0f} · Willingness to cook: {state.willingness_to_cook}/10",
    ]
    if state.craving:
        lines.append(f"- Craving: {state.craving}")
    if cuisines:
        lines.append(f"- Favorite cuisines: {', '.join(cuisines)}")
    if city:
        lines.append(f"- City: {city}")
    if vegetarian:
        lines.append("- Diet: vegetarian")
    if restrictions:
        lines.append(f"- Restrictions: {', '.join(restrictions)}")
    if skipped:
        lines.append(f"- Avoids: {', '.join(skipped)}")
    if pantry:
        names = [p.name for p in pantry[:30]]
        suffix = f" (+{len(pantry) - 30} more)" if len(pantry) > 30 else ""
        lines.append(f"- Pantry ({len(pantry)} items): {', '.join(names)}{suffix}")
    if expiring:
        lines.append(f"- Expiring soon (≤3 days): {', '.join(expiring)}")

    recent = (
        db.query(CookingHistoryModel)
        .filter(CookingHistoryModel.user_id == user_id)
        .order_by(CookingHistoryModel.timestamp.desc())
        .limit(5)
        .all()
    )
    if recent:
        lines.append("\n## Recent meals")
        for entry in recent:
            ts = entry.timestamp.strftime("%Y-%m-%d") if entry.timestamp else "?"
            dish = entry.recipe_name or entry.restaurant_name or entry.decision
            lines.append(f"- [{ts}] {entry.decision}: {dish}")

    return "\n".join(lines)


def _tool_meal_recommendation(db: Session, user_id: str, inputs: dict[str, Any]) -> Any:
    limit = min(max(int(inputs.get("limit", 3)), 1), 5)
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()
    state = _user_state(db, user_id)
    vegetarian, skipped, fav_cuisines, spice_level, diet_restrictions, _, _, _ = _diet(db, user_id)
    profile = get_user_profile(user_id, db)
    effective_cuisines = profile.preferred_cuisines or fav_cuisines
    results = recommend_recipes(
        pantry,
        state,
        limit,
        vegetarian=vegetarian,
        skipped_ingredients=skipped,
        favorite_cuisines=effective_cuisines,
        spice_level=spice_level,
        dietary_restrictions=diet_restrictions,
        meal_type=current_meal_type(),
    )
    return [
        {
            "name": r.name,
            "cuisine": r.cuisine,
            "pantry_match_pct": r.pantry_match_pct,
            "cook_time_minutes": r.cook_time_minutes,
            "uses_expiring": r.uses_expiring,
        }
        for r in results
    ]


def _tool_cook_vs_order(db: Session, user_id: str) -> Any:
    pantry = db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()
    state = _user_state(db, user_id)
    profile = get_user_profile(user_id, db)
    vegetarian, skipped, fav_cuisines, spice_level, diet_restrictions, people_count, city, cooking_skill = _diet(
        db, user_id
    )
    meal_type = current_meal_type()
    recs = recommend_recipes(
        pantry,
        state,
        1,
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

    rest_raw = pick_restaurant_for_user(
        db,
        user_id,
        state=state,
        vegetarian=vegetarian,
        city=city,
        cuisines=fav_cuisines,
    )

    from app.schemas import RestaurantOption

    restaurant = RestaurantOption(**rest_raw)
    result = compare_options(
        recipe,
        restaurant,
        state,
        pantry,
        _expiring_names(pantry),
        profile,
        people_count,
        cooking_skill,
    )
    result.narrative = generate_decision_narrative(result)
    return result.model_dump(mode="json")


def _tool_food_log(db: Session, user_id: str, inputs: dict[str, Any]) -> Any:
    date_param = inputs.get("date", "today")
    q = db.query(CookingHistoryModel).filter(CookingHistoryModel.user_id == user_id)
    if date_param == "today":
        day_start_utc, day_end_utc = meal_day_bounds(current_meal_day().isoformat())
    else:
        day_start_utc, day_end_utc = meal_day_bounds(date_param)
    entries = (
        q.filter(
            CookingHistoryModel.timestamp >= day_start_utc,
            CookingHistoryModel.timestamp < day_end_utc,
        )
        .order_by(CookingHistoryModel.timestamp.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "decision": e.decision,
            "recipe_name": e.recipe_name,
            "restaurant_name": e.restaurant_name,
            "cuisine": e.cuisine,
            "satisfaction": e.satisfaction,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in entries
    ]


def _tool_log_meal(db: Session, user_id: str, inputs: dict[str, Any]) -> Any:
    payload = CookingHistoryCreate(
        decision=inputs["decision"],
        recipe_name=inputs.get("recipe_name"),
        cuisine=inputs.get("cuisine"),
        satisfaction=inputs.get("satisfaction"),
        timestamp=inputs.get("timestamp"),
    )
    entry = CookingHistoryModel(
        user_id=user_id,
        decision=payload.decision,
        recipe_name=payload.recipe_name,
        restaurant_name=payload.restaurant_name,
        cuisine=payload.cuisine,
        satisfaction=payload.satisfaction,
        cost=payload.cost,
        **({"timestamp": payload.timestamp} if payload.timestamp else {}),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"saved": True, "id": entry.id}


def _execute_tool(name: str, inputs: dict[str, Any], db: Session, user_id: str) -> Any:
    if name == "get_meal_recommendation":
        return _tool_meal_recommendation(db, user_id, inputs)
    if name == "get_cook_vs_order":
        return _tool_cook_vs_order(db, user_id)
    if name == "get_food_log":
        return _tool_food_log(db, user_id, inputs)
    if name == "log_meal":
        return _tool_log_meal(db, user_id, inputs)
    return {"error": f"Unknown tool: {name}"}


@router.post("/chat")
async def agent_chat(
    req: AgentChatRequest,
    db: Session = Depends(get_db),
    header_user: Optional[UserAccountModel] = Depends(optional_user),
):
    from app.services.chef_agent import stream_groq_agent

    if not os.getenv("GROQ_API_KEY", "").strip():
        async def _no_key():
            yield (
                "data: "
                + json.dumps({"error": "AI chat not configured (GROQ_API_KEY missing)"})
                + "\n\n"
            )
            yield "data: [DONE]\n\n"

        return StreamingResponse(_no_key(), media_type="text/event-stream")

    user = header_user or get_user_for_token(db, req.sibling_token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    system = _build_system_prompt(db, user.id)
    msgs = [
        {"role": m["role"], "content": m["content"]}
        for m in req.messages
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    async def generate():
        try:
            async for event in stream_groq_agent(
                system=system,
                messages=msgs,
                tools=_TOOLS,
                execute_tool=_execute_tool,
                db=db,
                user_id=user.id,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
