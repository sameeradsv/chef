import { getAuthToken, setAuthToken } from "@shared/cortex";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";
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
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Auth (no Bearer needed) ---
export const auth = {
  login: async (username: string, passcode: string): Promise<{ access_token: string }> => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, passcode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(err.detail || "Login failed");
    }
    return res.json();
  },
  register: async (username: string, passcode: string): Promise<{ access_token: string }> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, passcode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Registration failed" }));
      throw new Error(err.detail || "Registration failed");
    }
    return res.json();
  },
};

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
  ingredients: { normalized_name: string; quantity: number; unit: string }[];
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
  narrative?: string;
}

export interface RecommendMealResult {
  recommendation: string;
  mode: "cook" | "order" | "eat_out";
  recipe?: Recipe;
  restaurant?: CookVsOrderResult["recommended_restaurant"];
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
  cuisine?: string;
  timestamp: string;
  satisfaction?: number;
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
  lookupBarcode: (barcode: string) =>
    request<BarcodeResult>(`/ingredients/barcode/${barcode}`),

  // Recipes
  recommendRecipes: (limit = 5) =>
    request<Recipe[]>(`/recipes/recommend?limit=${limit}`),
  searchRecipes: (q: string, cuisine?: string) => {
    const params = new URLSearchParams({ q });
    if (cuisine) params.set("cuisine", cuisine);
    return request<Recipe[]>(`/recipes/search?${params}`);
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
  updatePreferences: (data: { favorite_cuisines?: string; spice_level?: number; dietary_restrictions?: string; vegetarian?: boolean; skipped_ingredients?: string; city?: string; people_count?: number }) =>
    request<UserPreferences>("/user/preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Decisions
  cookVsOrder: (people_count?: number, recipe_id?: string) =>
    request<CookVsOrderResult>("/decision/cook-vs-order", {
      method: "POST",
      body: JSON.stringify({ people_count, ...(recipe_id ? { recipe_id } : {}) }),
    }),
  recommendMeal: () =>
    request<RecommendMealResult>("/decision/recommend-meal", {
      method: "POST",
      body: JSON.stringify({}),
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
  getHistory: (limit = 20) => request<HistoryEntry[]>(`/history?limit=${limit}`),
  logHistory: (data: { decision: string; recipe_name?: string; cuisine?: string; satisfaction?: number; timestamp?: string }) =>
    request<HistoryEntry>("/history", { method: "POST", body: JSON.stringify(data) }),
  updateHistory: (id: string, data: { decision?: string; recipe_name?: string; cuisine?: string; satisfaction?: number; timestamp?: string }) =>
    request<HistoryEntry>(`/history/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteHistory: (id: string) =>
    request<void>(`/history/${id}`, { method: "DELETE" }),
};
