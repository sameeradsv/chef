# Architecture

Chef is split into a static Next.js frontend and a FastAPI backend. The core product surface is deterministic decision scoring; AI is an auxiliary layer for narrative, parsing, recipe generation, and chat.

## Backend

| Area | Files |
| --- | --- |
| App startup, CORS, health, router registration | `backend/app/main.py` |
| DB session and additive migrations | `backend/app/database.py` |
| ORM models | `backend/app/models.py` |
| Pydantic API schemas | `backend/app/schemas.py` |
| Timezone conversion | `backend/app/tz_utils.py` |
| Seed data | `backend/app/seed.py`, `backend/data/*.json` |

Routers:

| Router | Purpose |
| --- | --- |
| `auth.py`, `webauthn.py` | JWT sessions, Cortex-linked accounts, passkeys |
| `ingredients.py` | Pantry CRUD, barcode lookup, discard/use flows |
| `recipes.py` | Recommendations, search, suggestions, detail |
| `decisions.py` | Cook/order/eat-out comparison, meal recommendation, predict, cost insights |
| `history.py` | Meal log, filters, summary, edit/delete |
| `grocery.py` | Grocery CRUD and suggestions |
| `energy.py`, `sync.py` | Meal-energy timeline, local Decide preset, export/import |
| `nutrition.py` | Keyword nutrition analysis and food suggestions |
| `vision.py`, `agent.py` | Groq vision parsing and native chat agent |
| `notifications.py` | Web Push subscriptions, reminder settings, cron dispatch |
| `plan.py` | Lightweight weekly meal plan |

## Data Semantics

All persisted user data is multi-user via `user_id`. Main tables:

| Model | Purpose |
| --- | --- |
| `UserAccountModel`, `AuthSessionModel` | Accounts and 30-day sessions |
| `WebAuthnCredential`, `WebAuthnChallenge` | Passkey registration/login |
| `IngredientModel` | Pantry item with normalized name, quantity, storage, expiry, cost |
| `DiscardedIngredientModel` | Waste log for discarded pantry items |
| `UserStateModel` | Decision defaults: energy, time, budget, health, craving, willingness, stress |
| `UserPreferencesModel` | Cuisine/diet, vegetarian, city, people count, cooking skill, restaurant delivery overrides |
| `CookingHistoryModel` | Meal/decision history, including prepared-by and home/travel location scope |
| `GroceryItemModel` | Grocery list items |
| `PushSubscriptionModel` | Browser push endpoints |
| `UserReminderSettingsModel` | Three daily reminder times and enabled flag |
| `ReminderDispatchLogModel` | Idempotent reminder dispatch audit |

## Timezone Contract

- API datetime inputs and outputs are naive IST wall-clock strings.
- Database `DateTime` columns store naive UTC.
- `CookingHistoryModel.timestamp` is the actual meal time; it drives history filtering, energy, and nutrition.
- `CookingHistoryModel.created_at` is DB insert time.
- `CookingHistoryModel.prepared_by` distinguishes meals cooked by the user (`self`) from home-cooked meals prepared by someone else (`other`). Both remain `decision="cook"` for meal analytics, nutrition, and history display, but only `self` increases personal cook rate/prediction; `other` uses a low/no-effort energy baseline.
- `CookingHistoryModel.location_context` scopes venue memory. `travel` entries still count for nutrition, energy, cost, and cuisine habits, but restaurant and order-item reuse only includes them when the current preference city matches `location_label`.
- Frontend helpers in `frontend/src/lib/tz.ts` must display and submit IST values only.

## Decision Engine

The engine lives in `backend/app/services/decision_engine.py`. It scores three modes:

```text
cook_score  = pantry_urgency + health + cost_savings - effort_cost - cleanup - skill_gap - missing_ingredient_cost
order_score = convenience + craving_match - delivery_delay - budget_penalty
eat_out     = similar to order, with travel/time/outing effort
```

Important behavior:

- Pantry expiry urgency is scoped to ingredients the recommended recipe actually uses.
- Expiring recipe ingredients add cook pressure.
- Missing ingredients add sourcing/cost penalty.
- Cooking skill gap is penalized when recipe difficulty exceeds saved skill.
- Low energy and high stress increase convenience value.
- If a primary venue is dine-in-only, eat-out uses it and order uses a separate delivery-capable pick when available.
- LLM narratives can explain the result, but never replace scoring.

## Recipe And Restaurant Sources

Recipes come from seed data, TheMealDB live search, and optional Groq generation. `services/mealdb.py` keeps a short in-process cache and falls back gracefully when Groq or TheMealDB are unavailable. Groq recipe generation asks for JSON in text and repairs common model issues locally, instead of provider-enforced JSON mode, so malformed fractions or truncation do not surface as hard 400s. Fast mode uses a smaller cache pool/prompt and dynamic completion cap to stay under Groq on-demand TPM limits.

Restaurants are seed/history/AI-derived comparison records, not live Swiggy/Zomato quotes. Delivery availability is inferred from history and user overrides stored in `restaurant_delivery_json`. History-derived venue suggestions are location-scoped: home entries are local to the saved city/area, and travel entries are excluded unless their label matches the current city/area.

## AI Boundaries

Groq-backed features:

| Feature | Location |
| --- | --- |
| Decision narratives and one-line suggestions | `services/llm.py` |
| Recipe generation | `services/mealdb.py` |
| Vision parsing | `routers/vision.py` |
| Native chat agent | `services/chef_agent.py`, `routers/agent.py` |

AI may explain tradeoffs, generate/understand recipes, normalize names, suggest substitutions, parse images, and power chat. AI must not own inventory counts, expiry calculations, freshness scoring, reminder scheduling, or final decision scores.

## Frontend

Frontend stack: Next.js 15, React 19, TypeScript, Tailwind CSS, static export to GitHub Pages.

| Path | Surface |
| --- | --- |
| `app/page.tsx` | Dashboard, expiring items, recommendation, week glance, meal plan |
| `app/inventory/page.tsx` | Pantry CRUD, voice/manual/photo/barcode capture, use/discard, restock |
| `app/decision/page.tsx` | Cook/order/eat-out cards, energy preset, overrides, rationale, predict/spend |
| `app/recipe/page.tsx`, `app/recipe/[id]/page.tsx` | Recipe browse/detail, coverage scatter, cooking steps |
| `app/grocery/page.tsx` | Grocery CRUD, suggestions, swipe-to-buy |
| `app/history/page.tsx` | Meal log, filters, screenshot parse, edit/delete |
| `app/health/page.tsx` | Macro rings, RDA bars, suggestions |
| `app/chat/page.tsx` | Terminal-style native Chef agent |
| `app/settings/page.tsx` | Preferences, decision defaults, reminders, passkeys, export/import |
| `app/login/page.tsx` | Login/register/passkey/Cortex flow |

Shared frontend modules:

| File | Purpose |
| --- | --- |
| `lib/api.ts` | Typed API wrapper and DTOs |
| `lib/cross-app-energy.ts` | Chef local `/sync/energy` fallback plus Cortex combined timeline preset |
| `lib/tz.ts` | IST date display/input helpers |
| `lib/use-notifications.ts` | Browser notification support and push subscription flow |
| `contexts/AuthContext.tsx` | Token state, login/register/logout |
| `contexts/ThemeContext.tsx` | Hearth/Mise theme state |

## UX Standards

- Mobile portrait, mobile landscape, tablet, and desktop must all be usable.
- Minimum tap target is 44 x 44 px.
- Voice affordances should appear on primary free-text capture paths when supported.
- New UI should follow the existing kitchen visual system and avoid fake integrations.
- Do not re-add the old Pantry theme, density controls, or UI-only connected-service toggles without real backend support.
