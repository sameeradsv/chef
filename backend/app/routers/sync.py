from __future__ import annotations

from datetime import datetime, timezone, time as _time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel
from app.tz_utils import (
    current_meal_day,
    logical_meal_date_from_utc_naive,
    meal_day_bounds,
    utc_naive_to_ist_str,
)

from app.services.export_crypto import decrypt_export, encrypt_export

router = APIRouter(prefix="/sync", tags=["sync"])

# Net drain per logged meal decision (0–1 scale).
# Eating provides biological energy that offsets the effort cost, so all values
# are kept below the minimum skip drain (0.15) — having any meal always leaves
# you better off than skipping it.  cook=0.12, eat_out=0.07, order=0.03.
_MEAL_DRAIN = {"cook": 0.12, "eat_out": 0.07, "order": 0.03}

_IST = timedelta(hours=5, minutes=30)

# Biological drain for skipped meal windows (name, window_open, window_close, drain)
_MEAL_WINDOWS: list[tuple[str, _time, _time, float]] = [
    ("breakfast", _time(7, 0),  _time(10, 30), 0.20),
    ("lunch",     _time(12, 0), _time(15, 0),  0.25),
    ("dinner",    _time(19, 0), _time(22, 0),  0.15),
]


@router.get("/energy")
def energy_summary(
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    """
    Returns the user's cooking-based energy drain split at the current moment.
    - drain_so_far: accumulated drain from logged meals + skipped meal windows
    - drain_ahead:  0 (cooking decisions are reactive, not pre-scheduled)

    Logged meal drain: cook=0.12, eat_out=0.07, order=0.03
    Skipped window drain: breakfast=0.20, lunch=0.25, dinner=0.15
    Having any meal always drains less than skipping it.
    Day boundary is meal-log day (06:00 IST → next 06:00), consistent with energy.py.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    meal_day = current_meal_day()
    today_start, today_end = meal_day_bounds(meal_day.isoformat())

    meals_today = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == current_user.id,
            CookingHistoryModel.timestamp >= today_start,
            CookingHistoryModel.timestamp < today_end,
        )
        .order_by(CookingHistoryModel.timestamp)
        .all()
    )

    past_drain = sum(_MEAL_DRAIN.get(m.decision, 0.10) for m in meals_today if m.timestamp <= now)

    # Add biological drain for meal windows that closed without any logged entry
    skipped_meals = []
    for name, w_start, w_end, skip_drain in _MEAL_WINDOWS:
        win_start_naive = datetime(meal_day.year, meal_day.month, meal_day.day,
                                   w_start.hour, w_start.minute) - _IST
        win_end_naive   = datetime(meal_day.year, meal_day.month, meal_day.day,
                                   w_end.hour, w_end.minute) - _IST
        if name == "dinner":
            if now < today_end:
                continue
        elif now < win_end_naive:
            continue
        covered = any(
            logical_meal_date_from_utc_naive(m.timestamp) == meal_day
            and (
                (name == "dinner" and (m.timestamp + _IST).hour < 6)
                or (win_start_naive <= m.timestamp < win_end_naive)
            )
            for m in meals_today
        )
        if covered:
            continue
        past_drain += skip_drain
        skipped_meals.append({"meal": name, "drain": skip_drain})

    meals_detail = [
        {
            "decision": m.decision,
            "at": utc_naive_to_ist_str(m.timestamp),
            "drain": _MEAL_DRAIN.get(m.decision, 0.10),
        }
        for m in meals_today
    ]

    return {
        "as_of": utc_naive_to_ist_str(now),
        "source": "chef",
        "drain_so_far": round(min(past_drain, 1.0), 3),
        "drain_ahead": 0.0,
        "energy_so_far": round(max(0.0, 1.0 - min(past_drain, 1.0)), 3),
        "energy_ahead": round(max(0.0, 1.0 - min(past_drain, 1.0)), 3),
        "meals_today": meals_detail,
        "skipped_meals": skipped_meals,
    }


class ExportBody(BaseModel):
    passphrase: str = Field(min_length=8, max_length=128)


class ImportBody(BaseModel):
    passphrase: str = Field(min_length=8, max_length=128)
    blob: dict


def _collect_chef_export(db: Session, user_id: str) -> dict:
    from app.models import GroceryItemModel, IngredientModel, UserPreferencesModel, UserStateModel

    ingredients = db.query(IngredientModel).filter(IngredientModel.user_id == user_id).all()
    grocery = db.query(GroceryItemModel).filter(GroceryItemModel.user_id == user_id).all()
    history = db.query(CookingHistoryModel).filter(CookingHistoryModel.user_id == user_id).limit(500).all()
    prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == user_id).first()
    state = db.query(UserStateModel).filter(UserStateModel.user_id == user_id).first()

    return {
        "ingredients": [
            {
                "name": i.name,
                "quantity": i.quantity,
                "unit": i.unit,
                "expiry_date": i.expiry_date.isoformat() if i.expiry_date else None,
                "buy_date": i.buy_date.isoformat() if i.buy_date else None,
                "storage_type": i.storage_type,
                "opened": i.opened,
            }
            for i in ingredients
        ],
        "grocery": [
            {"ingredient_name": g.ingredient_name, "quantity": g.quantity, "unit": g.unit, "bought": g.bought}
            for g in grocery
        ],
        "history": [
            {
                "decision": h.decision,
                "recipe_name": h.recipe_name,
                "restaurant_name": h.restaurant_name,
                "location_context": h.location_context or "home",
                "location_label": h.location_label,
                "cost": h.cost,
                "satisfaction": h.satisfaction,
                "timestamp": utc_naive_to_ist_str(h.timestamp),
            }
            for h in history
        ],
        "preferences": {
            "vegetarian": prefs.vegetarian if prefs else True,
            "favorite_cuisines": prefs.favorite_cuisines if prefs else "",
            "people_count": prefs.people_count if prefs else 2,
        } if prefs else None,
        "state": {
            "energy_level": state.energy_level,
            "budget_today": state.budget_today,
        } if state else None,
    }


@router.post("/export")
def export_data(
    body: ExportBody,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    payload = _collect_chef_export(db, current_user.id)
    return encrypt_export(payload, body.passphrase)


@router.post("/import")
def import_data(
    body: ImportBody,
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    from app.models import GroceryItemModel, IngredientModel
    from app.services.normalize import normalize_ingredient_name

    try:
        inner = decrypt_export(body.blob, body.passphrase)
    except Exception as exc:
        raise HTTPException(400, "Could not decrypt export") from exc

    ing_added = 0
    for row in inner.get("ingredients", []):
        name = (row.get("name") or "").strip()
        if not name:
            continue
        existing = (
            db.query(IngredientModel)
            .filter(IngredientModel.user_id == current_user.id, IngredientModel.name == name)
            .first()
        )
        if existing:
            continue
        db.add(IngredientModel(
            user_id=current_user.id,
            name=name,
            normalized_name=normalize_ingredient_name(name),
            quantity=row.get("quantity") or 1,
            unit=row.get("unit") or "pcs",
            storage_type=row.get("storage_type") or row.get("storage") or "fridge",
            opened=bool(row.get("opened")),
        ))
        ing_added += 1

    grocery_added = 0
    for row in inner.get("grocery", []):
        name = (row.get("ingredient_name") or "").strip()
        if not name:
            continue
        db.add(GroceryItemModel(
            user_id=current_user.id,
            ingredient_name=name,
            quantity=row.get("quantity") or 1,
            unit=row.get("unit") or "pcs",
            bought=bool(row.get("bought")),
        ))
        grocery_added += 1

    db.commit()
    return {"status": "merged", "ingredients_added": ing_added, "grocery_added": grocery_added}
