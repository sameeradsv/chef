import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class IngredientModel(Base):
    __tablename__ = "ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200))
    normalized_name: Mapped[str] = mapped_column(String(200), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(50), default="grams")
    buy_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    storage_type: Mapped[str] = mapped_column(String(50), default="fridge")
    opened: Mapped[bool] = mapped_column(Boolean, default=False)
    cost: Mapped[float] = mapped_column(Float, default=0)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    freshness_score: Mapped[float] = mapped_column(Float, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserStateModel(Base):
    __tablename__ = "user_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    energy_level: Mapped[int] = mapped_column(Integer, default=5)
    time_available_minutes: Mapped[int] = mapped_column(Integer, default=30)
    budget_today: Mapped[float] = mapped_column(Float, default=300)
    health_priority: Mapped[int] = mapped_column(Integer, default=5)
    craving: Mapped[str] = mapped_column(String(100), default="")
    willingness_to_cook: Mapped[int] = mapped_column(Integer, default=5)
    stress_level: Mapped[int] = mapped_column(Integer, default=5)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserPreferencesModel(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    favorite_cuisines: Mapped[str] = mapped_column(Text, default="Indian,South Indian")
    spice_level: Mapped[int] = mapped_column(Integer, default=5)
    dietary_restrictions: Mapped[str] = mapped_column(Text, default="")
