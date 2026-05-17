from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import IngredientModel, UserPreferencesModel, UserStateModel
from app.services.freshness import compute_freshness_score
from app.services.normalize import normalize_ingredient_name


def seed_database(db: Session) -> None:
    if db.query(IngredientModel).count() > 0:
        return

    today = date.today()
    samples = [
        {
            "name": "Paneer",
            "quantity": 250,
            "unit": "grams",
            "buy_date": today - timedelta(days=2),
            "expiry_date": today + timedelta(days=1),
            "storage_type": "fridge",
            "opened": True,
            "cost": 120,
            "brand": "Amul",
        },
        {
            "name": "Spinach",
            "quantity": 200,
            "unit": "grams",
            "buy_date": today - timedelta(days=1),
            "expiry_date": today + timedelta(days=2),
            "storage_type": "fridge",
            "opened": False,
            "cost": 40,
        },
        {
            "name": "Onions",
            "quantity": 4,
            "unit": "piece",
            "buy_date": today - timedelta(days=5),
            "expiry_date": today + timedelta(days=14),
            "storage_type": "pantry",
            "opened": False,
            "cost": 30,
        },
        {
            "name": "Eggs",
            "quantity": 6,
            "unit": "piece",
            "buy_date": today - timedelta(days=3),
            "expiry_date": today + timedelta(days=10),
            "storage_type": "fridge",
            "opened": False,
            "cost": 72,
        },
        {
            "name": "Rice",
            "quantity": 1000,
            "unit": "grams",
            "buy_date": today - timedelta(days=30),
            "expiry_date": today + timedelta(days=180),
            "storage_type": "pantry",
            "opened": True,
            "cost": 80,
        },
        {
            "name": "Tomatoes",
            "quantity": 4,
            "unit": "piece",
            "buy_date": today - timedelta(days=2),
            "expiry_date": today + timedelta(days=4),
            "storage_type": "fridge",
            "opened": False,
            "cost": 35,
        },
    ]

    for s in samples:
        ing = IngredientModel(
            name=s["name"],
            normalized_name=normalize_ingredient_name(s["name"]),
            quantity=s["quantity"],
            unit=s["unit"],
            buy_date=s["buy_date"],
            expiry_date=s["expiry_date"],
            storage_type=s["storage_type"],
            opened=s["opened"],
            cost=s["cost"],
            brand=s.get("brand"),
        )
        ing.freshness_score = compute_freshness_score(
            ing.expiry_date, ing.buy_date, ing.opened
        )
        db.add(ing)

    if not db.query(UserStateModel).filter(UserStateModel.id == 1).first():
        db.add(
            UserStateModel(
                id=1,
                energy_level=4,
                time_available_minutes=25,
                budget_today=250,
                health_priority=7,
                craving="spicy",
                willingness_to_cook=3,
                stress_level=6,
            )
        )

    if not db.query(UserPreferencesModel).filter(UserPreferencesModel.id == 1).first():
        db.add(
            UserPreferencesModel(
                id=1,
                favorite_cuisines="Indian,South Indian",
                spice_level=7,
            )
        )

    db.commit()
