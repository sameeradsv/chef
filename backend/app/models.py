import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthSessionModel(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_accounts.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


def _uuid() -> str:
    return str(uuid.uuid4())


class UserAccountModel(Base):
    __tablename__ = "user_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_passcode: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    # Set when this user was created via a Cortex account login
    cortex_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, unique=True, index=True)


class IngredientModel(Base):
    __tablename__ = "ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=True, index=True
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class UserStateModel(Base):
    __tablename__ = "user_state"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=True, unique=True, index=True
    )
    energy_level: Mapped[int] = mapped_column(Integer, default=5)
    time_available_minutes: Mapped[int] = mapped_column(Integer, default=30)
    budget_today: Mapped[float] = mapped_column(Float, default=300)
    health_priority: Mapped[int] = mapped_column(Integer, default=5)
    craving: Mapped[str] = mapped_column(String(100), default="")
    willingness_to_cook: Mapped[int] = mapped_column(Integer, default=5)
    stress_level: Mapped[int] = mapped_column(Integer, default=5)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class UserPreferencesModel(Base):
    __tablename__ = "user_preferences"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=True, unique=True, index=True
    )
    favorite_cuisines: Mapped[str] = mapped_column(Text, default="Indian,South Indian")
    spice_level: Mapped[int] = mapped_column(Integer, default=5)
    dietary_restrictions: Mapped[str] = mapped_column(Text, default="")
    vegetarian: Mapped[bool] = mapped_column(Boolean, default=True)
    skipped_ingredients: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[Optional[str]] = mapped_column(String(100), default="", nullable=True)
    people_count: Mapped[Optional[int]] = mapped_column(Integer, default=2, nullable=True)
    cooking_skill: Mapped[Optional[int]] = mapped_column(Integer, default=3, nullable=True)
    restaurant_delivery_json: Mapped[str] = mapped_column(Text, default="{}")


class PushSubscriptionModel(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (UniqueConstraint("endpoint", name="uq_push_subscriptions_endpoint"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    device_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    platform: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class UserReminderSettingsModel(Base):
    __tablename__ = "user_reminder_settings"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), primary_key=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    morning_time: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    afternoon_time: Mapped[str] = mapped_column(String(5), default="14:00", nullable=False)
    evening_time: Mapped[str] = mapped_column(String(5), default="20:00", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )


class ReminderDispatchLogModel(Base):
    __tablename__ = "reminder_dispatch_log"
    __table_args__ = (UniqueConstraint("dispatch_key", name="uq_reminder_dispatch_log_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reminder_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    dispatch_key: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="processing", nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    delivered_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class DiscardedIngredientModel(Base):
    __tablename__ = "discarded_ingredients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    ingredient_name: Mapped[str] = mapped_column(String(200))
    normalized_name: Mapped[str] = mapped_column(String(200), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(50), default="grams")
    cost: Mapped[float] = mapped_column(Float, default=0)
    buy_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    discard_reason: Mapped[str] = mapped_column(String(50), default="expired")
    discarded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class CookingHistoryModel(Base):
    __tablename__ = "cooking_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    decision: Mapped[str] = mapped_column(String(20))  # cook | order | eat_out
    recipe_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    restaurant_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cuisine: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    location_context: Mapped[str] = mapped_column(String(20), default="home")
    location_label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    satisfaction: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class GroceryItemModel(Base):
    __tablename__ = "grocery_list"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("user_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingredient_name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bought: Mapped[bool] = mapped_column(Boolean, default=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    credential_id: Mapped[str] = mapped_column(Text, primary_key=True)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    user_id: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class WebAuthnChallenge(Base):
    __tablename__ = "webauthn_challenges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    challenge: Mapped[str] = mapped_column(String(128), nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
