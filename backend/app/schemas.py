from datetime import date, datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, BeforeValidator, Field, PlainSerializer, field_validator

from app.tz_utils import ist_to_utc_naive_optional, utc_naive_to_ist_str


def _serialize_ist(dt: datetime | None) -> str | None:
    return utc_naive_to_ist_str(dt)


ISTDateTime = Annotated[
    datetime,
    PlainSerializer(_serialize_ist, return_type=str, when_used="always"),
]
OptionalISTDateTime = Annotated[
    Optional[datetime],
    PlainSerializer(_serialize_ist, return_type=str, when_used="always"),
]
ISTDateTimeInput = Annotated[Optional[datetime], BeforeValidator(ist_to_utc_naive_optional)]


class IngredientBase(BaseModel):
    name: str
    quantity: float = 0
    unit: str = "grams"
    buy_date: Optional[date] = None
    expiry_date: Optional[date] = None
    storage_type: str = "fridge"
    opened: bool = False
    cost: float = 0
    brand: Optional[str] = None


class IngredientCreate(IngredientBase):
    pass


class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    buy_date: Optional[date] = None
    expiry_date: Optional[date] = None
    storage_type: Optional[str] = None
    opened: Optional[bool] = None
    cost: Optional[float] = None
    brand: Optional[str] = None


class IngredientResponse(IngredientBase):
    id: str
    normalized_name: str
    freshness_score: float
    days_until_expiry: Optional[int] = None
    expiry_urgency: float = 0
    created_at: ISTDateTime

    model_config = {"from_attributes": True}


class IngredientOverride(BaseModel):
    normalized_name: str
    quantity: float


class ConsumeRecipeRequest(BaseModel):
    overrides: List[IngredientOverride] = Field(default_factory=list)


class ConsumeRecipeResponse(BaseModel):
    consumed: List[str]   # ingredients whose quantity was reduced
    depleted: List[str]   # ingredients fully used up and removed
    not_found: List[str]  # recipe ingredients not in pantry


class BarcodeResult(BaseModel):
    barcode: str
    product_name: str
    ingredient_name: str
    brand: str
    quantity: float
    unit: str
    nutrition_score: float


class DiscardRequest(BaseModel):
    reason: str = "expired"  # expired | spoiled | other


class DiscardedIngredientResponse(BaseModel):
    id: str
    ingredient_name: str
    normalized_name: str
    quantity: float
    unit: str
    cost: float
    buy_date: Optional[date]
    expiry_date: Optional[date]
    discard_reason: str
    discarded_at: ISTDateTime

    model_config = {"from_attributes": True}


class WasteSummaryItem(BaseModel):
    normalized_name: str
    ingredient_name: str
    discard_count: int
    total_cost: float


class RecipeIngredient(BaseModel):
    normalized_name: str
    quantity: float
    unit: str
    in_pantry: bool = False


class RecipeResponse(BaseModel):
    id: str
    name: str
    ingredients: List[RecipeIngredient]
    prep_time_minutes: int
    cook_time_minutes: int
    difficulty: int
    cleanup_effort: int
    nutrition_score: int
    comfort_score: int
    estimated_cost: float
    requires_attention: bool
    cuisine: str
    meal_type: str = "any"
    serves: int = 2
    pantry_match_pct: float = 0
    uses_expiring: List[str] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)
    substitutions: List[Dict[str, Any]] = Field(default_factory=list)


class UserStatePayload(BaseModel):
    energy_level: int = Field(5, ge=1, le=10)
    time_available_minutes: int = Field(30, ge=5)
    budget_today: float = Field(300, ge=0)
    health_priority: int = Field(5, ge=1, le=10)
    craving: str = ""
    willingness_to_cook: int = Field(5, ge=1, le=10)
    stress_level: int = Field(5, ge=1, le=10)


class UserStateResponse(UserStatePayload):
    updated_at: OptionalISTDateTime = None


class UserPreferencesResponse(BaseModel):
    favorite_cuisines: List[str] = Field(default_factory=list)
    spice_level: int = 5
    dietary_restrictions: List[str] = Field(default_factory=list)
    vegetarian: bool = True
    skipped_ingredients: List[str] = Field(default_factory=list)
    city: str = ""
    people_count: int = 2
    cooking_skill: int = 3
    restaurant_delivery: Dict[str, bool] = Field(default_factory=dict)


class UserPreferencesPayload(BaseModel):
    favorite_cuisines: Optional[str] = None
    spice_level: Optional[int] = Field(None, ge=1, le=10)
    dietary_restrictions: Optional[str] = None
    vegetarian: Optional[bool] = None
    skipped_ingredients: Optional[str] = None
    city: Optional[str] = None
    people_count: Optional[int] = Field(None, ge=1, le=20)
    cooking_skill: Optional[int] = Field(None, ge=1, le=5)


class RestaurantOption(BaseModel):
    id: str
    platform: str
    restaurant_name: str
    estimated_delivery_minutes: int
    total_cost: float
    delivery_fee: float
    rating: float
    cuisine: str
    discount_available: bool = False
    delivery_available: bool = True


class DecisionOption(BaseModel):
    mode: Literal["cook", "order", "eat_out"]
    label: str
    score: float
    cost: float
    time_minutes: int
    effort_label: str
    effort_score: float
    factors: Dict[str, float]
    details: Dict[str, Any] = Field(default_factory=dict)


class CookVsOrderRequest(BaseModel):
    recipe_id: Optional[str] = None
    restaurant_id: Optional[str] = None
    people_count: Optional[int] = Field(None, ge=1, le=20)


class CookVsOrderResponse(BaseModel):
    recommendation: Literal["cook", "order", "eat_out"]
    options: List[DecisionOption]
    reasoning: List[str]
    recommended_recipe: Optional[RecipeResponse] = None
    recommended_restaurant: Optional[RestaurantOption] = None
    narrative: str = ""


class RecommendMealResponse(BaseModel):
    recommendation: str
    mode: Literal["cook", "order", "eat_out"]
    recipe: Optional[RecipeResponse] = None
    restaurant: Optional[RestaurantOption] = None
    reasoning: List[str]
    savings_vs_order: float = 0
    narrative: str = ""


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    passcode: str = Field(..., min_length=4, max_length=100)

    @field_validator("username")
    @classmethod
    def username_no_spaces(cls, v: str) -> str:
        if " " in v:
            raise ValueError("Username must not contain spaces")
        return v.lower()


class LoginRequest(BaseModel):
    username: str
    passcode: str


class TokenResponse(BaseModel):
    token: str
    user: "UserAccountResponse"


class UserAccountResponse(BaseModel):
    id: str
    username: str
    created_at: ISTDateTime

    model_config = {"from_attributes": True}


# ── Cooking history ───────────────────────────────────────────────────────────

class CookingHistoryCreate(BaseModel):
    decision: Literal["cook", "order", "eat_out"]
    recipe_name: Optional[str] = None
    restaurant_name: Optional[str] = None
    cuisine: Optional[str] = None
    satisfaction: Optional[int] = Field(None, ge=1, le=5)
    timestamp: ISTDateTimeInput = None
    cost: Optional[float] = None
    delivery_available: Optional[bool] = None


class CookingHistoryUpdate(BaseModel):
    decision: Optional[Literal["cook", "order", "eat_out"]] = None
    recipe_name: Optional[str] = None
    restaurant_name: Optional[str] = None
    cuisine: Optional[str] = None
    satisfaction: Optional[int] = Field(None, ge=1, le=5)
    timestamp: ISTDateTimeInput = None
    cost: Optional[float] = None
    delivery_available: Optional[bool] = None


class CookingHistoryResponse(BaseModel):
    id: str
    decision: str
    recipe_name: Optional[str]
    restaurant_name: Optional[str] = None
    cuisine: Optional[str]
    timestamp: ISTDateTime
    satisfaction: Optional[int]
    cost: Optional[float] = None
    created_at: OptionalISTDateTime = None

    model_config = {"from_attributes": True}


class HistorySummary(BaseModel):
    total: int
    total_spent: float
    cook: int
    order: int
    eat_out: int


class HistoryPageResponse(BaseModel):
    items: List[CookingHistoryResponse]
    total: int
    offset: int
    limit: int
    summary: HistorySummary


# ── Grocery ───────────────────────────────────────────────────────────────────

class GroceryItemCreate(BaseModel):
    ingredient_name: str = Field(..., min_length=1, max_length=200)
    quantity: Optional[float] = None
    unit: Optional[str] = None


class GroceryItemUpdate(BaseModel):
    bought: Optional[bool] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None


class GroceryItemResponse(BaseModel):
    id: str
    ingredient_name: str
    quantity: Optional[float]
    unit: Optional[str]
    bought: bool
    added_at: ISTDateTime

    model_config = {"from_attributes": True}


# ── Personalization ───────────────────────────────────────────────────────────

class UserProfileResponse(BaseModel):
    preferred_cuisines: List[str] = Field(default_factory=list)
    cook_rate: float = 0.5
    avg_satisfaction: Optional[float] = None
    weekday_tendency: str = "balanced"
    favorite_cuisines: List[str] = Field(default_factory=list)
    spice_level: int = 5
    dietary_restrictions: List[str] = Field(default_factory=list)
    vegetarian: bool = True
    skipped_ingredients: List[str] = Field(default_factory=list)
    city: str = ""


# ── Nutrition / Health ────────────────────────────────────────────────────────

class NutrientStat(BaseModel):
    key: str
    label: str
    unit: str
    daily_avg: float
    rda: float
    pct_rda: float
    status: str  # "low" | "ok" | "high"


class FoodSuggestion(BaseModel):
    food: str
    reason: str
    meal_type: str  # breakfast | lunch | snack | dinner | any
    nutrients: List[str]


class NutritionSummary(BaseModel):
    days_analyzed: int
    meals_logged: int
    nutrients: List[NutrientStat]
    gaps: List[str]
    suggestions: List[FoodSuggestion]
    meal_suggestions: Dict[str, List[FoodSuggestion]]
