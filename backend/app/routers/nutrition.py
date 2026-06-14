from __future__ import annotations

from datetime import datetime, timedelta

_IST = timedelta(hours=5, minutes=30)

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import CookingHistoryModel, UserAccountModel
from app.schemas import FoodSuggestion, NutrientStat, NutritionSummary
from app.services.health import (
    DAILY_RDA,
    NUTRIENT_LABELS,
    NUTRIENT_UNITS,
    analyze_history,
    build_suggestions,
)

router = APIRouter(prefix="/nutrition", tags=["nutrition"])

_LIMIT_HIGH = {"sugar_g", "sodium_mg"}  # lower is better for these


@router.get("/summary", response_model=NutritionSummary)
def nutrition_summary(
    days: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: UserAccountModel = Depends(get_current_user),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    entries = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == current_user.id,
            CookingHistoryModel.timestamp >= cutoff,
        )
        .order_by(CookingHistoryModel.timestamp.desc())
        .all()
    )

    meals_with_names = [e for e in entries if e.recipe_name]
    averages = analyze_history(entries, days)
    days_with_data = len({(e.timestamp + _IST).date() for e in entries}) if entries else 0

    nutrient_stats = []
    for key, rda in DAILY_RDA.items():
        val = round(averages.get(key, 0.0), 1)
        pct = round(val / rda * 100, 1) if rda else 0.0
        if key in _LIMIT_HIGH:
            status = "high" if pct > 130 else "ok"
        else:
            if pct < 70:
                status = "low"
            elif pct <= 150:
                status = "ok"
            else:
                status = "high"
        nutrient_stats.append(
            NutrientStat(
                key=key,
                label=NUTRIENT_LABELS[key],
                unit=NUTRIENT_UNITS[key],
                daily_avg=val,
                rda=rda,
                pct_rda=pct,
                status=status,
            )
        )

    suggestions_raw, meal_sugg_raw = build_suggestions(averages)
    suggestions = [FoodSuggestion(**s) for s in suggestions_raw]
    meal_suggestions = {
        mt: [FoodSuggestion(**s) for s in suggs]
        for mt, suggs in meal_sugg_raw.items()
    }

    gaps = [
        (
            f"{ns.label} is low ({int(ns.pct_rda)}% of daily target)"
            if ns.status == "low"
            else f"{ns.label} is high ({int(ns.pct_rda)}% of recommended limit)"
        )
        for ns in nutrient_stats
        if ns.status != "ok"
    ]

    return NutritionSummary(
        days_analyzed=days_with_data,
        meals_logged=len(meals_with_names),
        nutrients=nutrient_stats,
        gaps=gaps[:6],
        suggestions=suggestions,
        meal_suggestions=meal_suggestions,
    )
