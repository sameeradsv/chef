import { getAuthToken, setAuthToken } from "@shared/cortex";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const APP_BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
const TOKEN_KEY = "chef_auth_token";

// --- Token helpers (kept for backward compat within this file) ---
export function getToken(): string | null {
  return getAuthToken(TOKEN_KEY);
}
export function setToken(t: string): void {
  setAuthToken(TOKEN_KEY, t);
}
export function clearToken(): void {
  setAuthToken(TOKEN_KEY, null);
}

export function appPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE}${normalized}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event("chef:unauthorized"));
    if (typeof window !== "undefined") window.location.replace(appPath("/login"));
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Types ---

export interface BarcodeResult {
  barcode: string;
  product_name: string;
  ingredient_name: string;
  brand: string;
  quantity: number;
  unit: string;
  nutrition_score: number;
}

export interface Ingredient {
  id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  buy_date?: string;
  expiry_date?: string;
  storage_type: string;
  opened: boolean;
  cost: number;
  brand?: string;
  freshness_score: number;
  days_until_expiry?: number;
  expiry_urgency: number;
  created_at: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: { normalized_name: string; quantity: number; unit: string; in_pantry: boolean }[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  difficulty: number;
  cleanup_effort: number;
  nutrition_score: number;
  comfort_score: number;
  estimated_cost: number;
  requires_attention: boolean;
  cuisine: string;
  meal_type: string;
  serves: number;
  pantry_match_pct: number;
  uses_expiring: string[];
  instructions: string[];
  substitutions: { missing: string; substitute: string; note: string }[];
}

export interface UserState {
  energy_level: number;
  time_available_minutes: number;
  budget_today: number;
  health_priority: number;
  craving: string;
  willingness_to_cook: number;
  stress_level: number;
}

export interface DecisionOption {
  mode: "cook" | "order" | "eat_out";
  label: string;
  score: number;
  cost: number;
  time_minutes: number;
  effort_label: string;
  effort_score: number;
  factors: Record<string, number>;
  details: Record<string, string>;
}

export interface OrderItemSuggestion {
  name: string;
  source: "history" | "groq" | "mealdb" | "seed";
  cuisine?: string;
  restaurant_name?: string;
}

export interface CookVsOrderResult {
  recommendation: "cook" | "order" | "eat_out";
  options: DecisionOption[];
  reasoning: string[];
  recommended_recipe?: Recipe;
  recommended_restaurant?: {
    id: string;
    platform: string;
    restaurant_name: string;
    estimated_delivery_minutes: number;
    total_cost: number;
    cuisine: string;
  };
  recommended_order_item?: OrderItemSuggestion;
  narrative?: string;
}

export interface RecommendMealResult {
  recommendation: string;
  mode: "cook" | "order" | "eat_out";
  recipe?: Recipe;
  restaurant?: CookVsOrderResult["recommended_restaurant"];
  order_item?: OrderItemSuggestion;
  reasoning: string[];
  savings_vs_order: number;
  narrative?: string;
}

export interface UserPreferences {
  favorite_cuisines: string[];
  spice_level: number;
  dietary_restrictions: string[];
  vegetarian: boolean;
  skipped_ingredients: string[];
  city: string;
  people_count: number;
  cooking_skill: number;
  restaurant_delivery?: Record<string, boolean>;
}

export interface DiscardedIngredient {
  id: string;
  ingredient_name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  cost: number;
  buy_date?: string;
  expiry_date?: string;
  discard_reason: string;
  discarded_at: string;
}

export interface WasteSummaryItem {
  normalized_name: string;
  ingredient_name: string;
  discard_count: number;
  total_cost: number;
}

export interface GroceryItem {
  id: string;
  ingredient_name: string;
  quantity?: number;
  unit?: string;
  bought: boolean;
  added_at: string;
}

export interface HistoryEntry {
  id: string;
  decision: "cook" | "order" | "eat_out";
  recipe_name?: string;
  restaurant_name?: string;
  cuisine?: string;
  prepared_by?: "self" | "other";
  location_context?: "home" | "travel";
  location_label?: string;
  timestamp: string;    // naive IST — meal date/time
  created_at?: string;  // naive IST — when the entry was logged
  satisfaction?: number;
  cost?: number;
}

export interface HistorySummary {
  total: number;
  total_spent: number;
  cook: number;
  self_cook?: number;
  other_home_cooked?: number;
  order: number;
  eat_out: number;
}

export interface HistoryPage {
  items: HistoryEntry[];
  total: number;
  offset: number;
  limit: number;
  summary: HistorySummary;
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
  date?: string;
}

export interface ParsedOrder {
  type: "order";
  decision: "cook" | "order" | "eat_out";
  meal_name?: string;
  cuisine?: string;
  restaurant_name?: string;
  timestamp?: string;
}

export interface ParsedIngredientItem {
  name: string;
  quantity?: number;
  unit?: string;
}

export interface ParsedIngredients {
  type: "ingredients";
  items: ParsedIngredientItem[];
}

export interface ParsedProduct {
  type: "product";
  name?: string;
  brand?: string;
  quantity?: number;
  unit?: string;
  expiry_date?: string;  // YYYY-MM-DD or null
  price?: number;
  storage_type?: string;
}

export interface NutrientStat {
  key: string;
  label: string;
  unit: string;
  daily_avg: number;
  rda: number;
  pct_rda: number;
  status: "low" | "ok" | "high";
}

export interface FoodSuggestion {
  food: string;
  reason: string;
  meal_type: string;
  nutrients: string[];
}

export interface NutritionSummary {
  days_analyzed: number;
  meals_logged: number;
  nutrients: NutrientStat[];
  gaps: string[];
  suggestions: FoodSuggestion[];
  meal_suggestions: Record<string, FoodSuggestion[]>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  device_name?: string;
  platform?: string;
}

export interface ReminderSettings {
  enabled: boolean;
  morning_time: string;
  afternoon_time: string;
  evening_time: string;
  updated_at?: string | null;
}

// --- API ---

export const api = {
  // Ingredients
  getIngredients: (params?: { storage?: string; expiring_soon?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.storage) q.set("storage", params.storage);
    if (params?.expiring_soon) q.set("expiring_soon", "true");
    const qs = q.toString();
    return request<Ingredient[]>(`/ingredients${qs ? `?${qs}` : ""}`);
  },
  createIngredient: (data: Partial<Ingredient>) =>
    request<Ingredient>("/ingredients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateIngredient: (id: string, data: Partial<Ingredient>) =>
    request<Ingredient>(`/ingredients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteIngredient: (id: string) =>
    request<void>(`/ingredients/${id}`, { method: "DELETE" }),
  discardIngredient: (id: string, reason: string) =>
    request<DiscardedIngredient>(`/ingredients/${id}/discard`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  getDiscardedIngredients: () =>
    request<DiscardedIngredient[]>("/ingredients/discarded"),
  getWasteSummary: () =>
    request<WasteSummaryItem[]>("/ingredients/waste-summary"),
  consumeRecipe: (recipeId: string, overrides?: Array<{ normalized_name: string; quantity: number }>) =>
    request<{ consumed: string[]; depleted: string[]; not_found: string[] }>(
      `/ingredients/consume-recipe/${recipeId}`,
      {
        method: "POST",
        ...(overrides && overrides.length > 0 ? { body: JSON.stringify({ overrides }) } : {}),
      }
    ),
  lookupBarcode: (barcode: string) =>
    request<BarcodeResult>(`/ingredients/barcode/${barcode}`),

  // Recipes
  recommendRecipes: (limit = 5, meal_type?: string, fast = false) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (meal_type) params.set("meal_type", meal_type);
    if (fast) params.set("fast", "true");
    return request<Recipe[]>(`/recipes/recommend?${params}`);
  },
  getMealSuggestion: (meal_type: string) =>
    request<{ suggestion: string }>(`/recipes/suggest?meal_type=${meal_type}`),
  searchRecipes: (q: string, cuisine?: string, options?: RequestInit) => {
    const params = new URLSearchParams({ q });
    if (cuisine) params.set("cuisine", cuisine);
    return request<Recipe[]>(`/recipes/search?${params}`, options);
  },
  getRecipe: (id: string) => request<Recipe>(`/recipes/${id}`),

  // User state
  getUserState: () => request<UserState>("/user/state"),
  setUserState: (state: UserState) =>
    request<UserState & { updated_at?: string }>("/user/state", {
      method: "POST",
      body: JSON.stringify(state),
    }),

  // User preferences
  getPreferences: () => request<UserPreferences>("/user/preferences"),
  updatePreferences: (data: { favorite_cuisines?: string; spice_level?: number; dietary_restrictions?: string; vegetarian?: boolean; skipped_ingredients?: string; city?: string; people_count?: number; cooking_skill?: number }) =>
    request<UserPreferences>("/user/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Decisions
  cookVsOrder: (people_count?: number, recipe_id?: string, state?: Partial<UserState>) =>
    request<CookVsOrderResult>("/decision/cook-vs-order", {
      method: "POST",
      body: JSON.stringify({
        people_count,
        ...(recipe_id ? { recipe_id } : {}),
        ...(state ?? {}),
      }),
    }),
    recommendMeal: (fast = false) =>
    request<RecommendMealResult>(
      `/decision/recommend-meal${fast ? "?fast=true" : ""}`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    ),
  predictMeal: () =>
    request<{
      likely_decision: string;
      confidence: number;
      message: string;
      savings_hint?: string | null;
    }>("/decision/predict"),
  costInsights: () =>
    request<{ insights: string[]; meal_count: number }>("/decision/cost-insights"),
  weekPlan: () =>
    request<{
      days: {
        date: string;
        label: string;
        recipe_id: string | null;
        recipe_name: string | null;
        pantry_match_pct: number;
        uses_expiring: string[];
        hint: string;
      }[];
      expiring_soon: string[];
    }>("/plan/week"),
  exportData: (passphrase: string) =>
    request<Record<string, unknown>>("/sync/export", {
      method: "POST",
      body: JSON.stringify({ passphrase }),
    }),
  importData: (passphrase: string, blob: Record<string, unknown>) =>
    request<{ status: string; ingredients_added: number; grocery_added: number }>("/sync/import", {
      method: "POST",
      body: JSON.stringify({ passphrase, blob }),
    }),

  // Grocery
  listGrocery: () => request<GroceryItem[]>("/grocery"),
  grocerySuggestions: () => request<string[]>("/grocery/suggestions"),
  addGrocery: (data: { ingredient_name: string; quantity?: number; unit?: string }) =>
    request<GroceryItem>("/grocery", { method: "POST", body: JSON.stringify(data) }),
  updateGrocery: (id: string, data: { bought?: boolean; quantity?: number; unit?: string }) =>
    request<GroceryItem>(`/grocery/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGrocery: (id: string) => request<void>(`/grocery/${id}`, { method: "DELETE" }),

  // History
  getHistoryPage: (query: HistoryQuery = {}) => {
    const params = new URLSearchParams({ include_summary: "true" });
    if (query.limit != null) params.set("limit", String(query.limit));
    if (query.offset != null) params.set("offset", String(query.offset));
    if (query.from) params.set("from_date", query.from);
    if (query.to) params.set("to_date", query.to);
    if (query.date) params.set("date", query.date);
    return request<HistoryPage>(`/history?${params.toString()}`);
  },
  logHistory: (data: { decision: string; recipe_name?: string; restaurant_name?: string; cuisine?: string; prepared_by?: "self" | "other"; location_context?: "home" | "travel"; location_label?: string; satisfaction?: number; timestamp?: string; cost?: number; delivery_available?: boolean }) =>
    request<HistoryEntry>("/history", { method: "POST", body: JSON.stringify(data) }),
  updateHistory: (id: string, data: { decision?: string; recipe_name?: string; restaurant_name?: string; cuisine?: string; prepared_by?: "self" | "other"; location_context?: "home" | "travel"; location_label?: string; satisfaction?: number; timestamp?: string; cost?: number; delivery_available?: boolean }) =>
    request<HistoryEntry>(`/history/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteHistory: (id: string) =>
    request<void>(`/history/${id}`, { method: "DELETE" }),

  // Vision
  parseImage: (imageBase64: string, imageType: string, parseType: "order" | "ingredients" | "product") =>
    request<ParsedOrder | ParsedIngredients | ParsedProduct>("/vision/parse", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64, image_type: imageType, parse_type: parseType }),
    }),

  // Nutrition
  getNutritionSummary: (days = 7) =>
    request<NutritionSummary>(`/nutrition/summary?days=${days}`),

  // Notifications
  getVapidPublicKey: async () => {
    const result = await request<{ public_key: string }>("/api/notifications/vapid-public-key");
    return result.public_key;
  },
  subscribeDevice: (data: PushSubscriptionInput) =>
    request<{ id: string }>("/api/notifications/subscriptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  unsubscribeDevice: (endpoint: string) =>
    request<void>("/api/notifications/subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    }),
  getReminderSettings: () => request<ReminderSettings>("/api/notifications/settings"),
  updateReminderSettings: (data: ReminderSettings) =>
    request<ReminderSettings>("/api/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
