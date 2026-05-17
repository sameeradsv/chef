from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import (
    IngredientModel,
    UserAccountModel,
    UserPreferencesModel,
    UserStateModel,
)
from app.services.freshness import compute_freshness_score
from app.services.normalize import normalize_ingredient_name


def seed_database(db: Session) -> None:
    # Only seed on a completely fresh database (no users yet)
    if db.query(UserAccountModel).count() > 0:
        return

    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

    demo = UserAccountModel(
        username="demo",
        hashed_passcode=pwd.hash("demo1234"),
    )
    db.add(demo)
    db.flush()  # populate demo.id before using it

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
            user_id=demo.id,
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

    db.add(
        UserStateModel(
            user_id=demo.id,
            energy_level=4,
            time_available_minutes=25,
            budget_today=250,
            health_priority=7,
            craving="spicy",
            willingness_to_cook=3,
            stress_level=6,
        )
    )
    db.add(
        UserPreferencesModel(
            user_id=demo.id,
            favorite_cuisines="Indian,South Indian",
            spice_level=7,
        )
    )

    db.commit()
