from datetime import date

from app.models import IngredientModel
from app.schemas import IngredientResponse
from app.services.freshness import (
    compute_expiry_urgency,
    compute_freshness_score,
    days_until_expiry,
)


def ingredient_to_response(ing: IngredientModel) -> IngredientResponse:
    today = date.today()
    freshness = compute_freshness_score(
        ing.expiry_date, ing.buy_date, ing.opened, today
    )
    urgency = compute_expiry_urgency(ing.expiry_date, today)
    days = days_until_expiry(ing.expiry_date, today)
    return IngredientResponse(
        id=ing.id,
        name=ing.name,
        normalized_name=ing.normalized_name,
        quantity=ing.quantity,
        unit=ing.unit,
        buy_date=ing.buy_date,
        expiry_date=ing.expiry_date,
        storage_type=ing.storage_type,
        opened=ing.opened,
        cost=ing.cost,
        brand=ing.brand,
        freshness_score=freshness,
        days_until_expiry=days,
        expiry_urgency=urgency,
        created_at=ing.created_at,
    )


def refresh_freshness(ing: IngredientModel) -> None:
    ing.freshness_score = compute_freshness_score(
        ing.expiry_date, ing.buy_date, ing.opened
    )
