import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthSessionModel(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_accounts.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


def _uuid() -> str:
    return str(uuid.uuid4())


class UserAccountModel(Base):
    __tablename__ = "user_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_passcode: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class IngredientModel(Base):
    __tablename__ = "ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user_accounts.id"), nullable=True, index=True
    )
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user_accounts.id"), nullable=True, unique=True, index=True
    )
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

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user_accounts.id"), nullable=True, unique=True, index=True
    )
    favorite_cuisines: Mapped[str] = mapped_column(Text, default="Indian,South Indian")
    spice_level: Mapped[int] = mapped_column(Integer, default=5)
    dietary_restrictions: Mapped[str] = mapped_column(Text, default="")
    vegetarian: Mapped[bool] = mapped_column(Boolean, default=True)
    skipped_ingredients: Mapped[str] = mapped_column(Text, default="")


class CookingHistoryModel(Base):
    __tablename__ = "cooking_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id"), nullable=False, index=True
    )
    decision: Mapped[str] = mapped_column(String(20))  # cook | order | eat_out
    recipe_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cuisine: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    satisfaction: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5


class GroceryItemModel(Base):
    __tablename__ = "grocery_list"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id"), nullable=False, index=True
    )
    ingredient_name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bought: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
