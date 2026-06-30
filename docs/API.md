# API

Base app: FastAPI. Most endpoints require `Authorization: Bearer <token>` except registration/login, public passkey login begin/complete, health checks, and reminder cron endpoints, which use `Authorization: Bearer <REMINDER_CRON_SECRET>`.

All API datetimes exposed to the frontend are naive IST strings (`YYYY-MM-DDTHH:MM:SS`).

## Auth

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account, return JWT |
| `POST` | `/auth/login` | Login with passcode, return JWT |
| `DELETE` | `/auth/logout` | Invalidate current session |
| `GET` | `/auth/me` | Current account |
| `GET` | `/auth/status` | Whether any user exists |
| `DELETE` | `/auth/account` | Delete current account |
| `POST` | `/auth/webauthn/register/begin` | Begin passkey registration |
| `POST` | `/auth/webauthn/register/complete` | Complete passkey registration |
| `POST` | `/auth/webauthn/login/begin` | Begin passkey login |
| `POST` | `/auth/webauthn/login/complete` | Complete passkey login, return JWT |

## Pantry

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/ingredients` | List pantry; filters include `storage` and `expiring_soon` |
| `POST` | `/ingredients` | Add ingredient |
| `PUT` | `/ingredients/{id}` | Update ingredient |
| `DELETE` | `/ingredients/{id}` | Delete ingredient |
| `GET` | `/ingredients/barcode/{barcode}` | Open Food Facts lookup |
| `POST` | `/ingredients/{id}/discard` | Move ingredient to waste log |
| `GET` | `/ingredients/discarded` | Waste log |
| `GET` | `/ingredients/waste-summary` | Aggregate discarded cost/count by normalized item |
| `POST` | `/ingredients/consume-recipe/{recipe_id}` | Reduce pantry quantities for a cooked recipe |

## Recipes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/recipes/suggest` | Optional one-line meal suggestion from Groq |
| `GET` | `/recipes/recommend` | Pantry and history-aware recipe recommendations |
| `GET` | `/recipes/search?q=&cuisine=` | Keyword search across seed, TheMealDB, and generated pool |
| `GET` | `/recipes/{id}` | Recipe detail |

`services/mealdb.py` uses Groq recipe generation when `GROQ_API_KEY` is set, then falls back to TheMealDB and seed recipes.

## Decision

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/decision/cook-vs-order` | Score cook, order, and eat-out options |
| `POST` | `/decision/recommend-meal` | Return a single recommended meal path |
| `GET` | `/decision/predict` | History-based likely mode prediction |
| `GET` | `/decision/cost-insights` | Spend and savings trend card |

`cook-vs-order` accepts session-only overrides such as `energy_level`, `willingness_to_cook`, `time_available_minutes`, `budget_today`, `health_priority`, `stress_level`, `people_count`, and `craving`.

## User State And Preferences

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/user/state` | Current decision defaults: energy, time, budget, health, craving, willingness, stress |
| `POST` | `/user/state` | Save decision defaults |
| `GET` | `/user/preferences` | Cuisine, spice, dietary, vegetarian, skipped ingredients, city, people, cooking skill, restaurant delivery overrides |
| `PUT` | `/user/preferences` | Update preferences |

## Grocery

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/grocery` | List grocery items |
| `POST` | `/grocery` | Add item |
| `PUT` | `/grocery/{id}` | Mark bought or update quantity/unit |
| `DELETE` | `/grocery/{id}` | Remove item |
| `GET` | `/grocery/suggestions` | Pantry-gap and bought-history suggestions |

## History

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/history` | List meal/decision log |
| `POST` | `/history` | Log decision |
| `PATCH` | `/history/{id}` | Edit entry |
| `DELETE` | `/history/{id}` | Delete entry |

`GET /history` supports `limit`, `offset`, `from_date`, `to_date`, `date=today|YYYY-MM-DD`, and `include_summary=true`. Without `include_summary`, it returns a plain array for compatibility with Conduit.

`timestamp` is the meal time and drives history filters, energy, and nutrition. `created_at` is insert time.

## Energy, Nutrition, Plan, Sync

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/energy/timeline?date=YYYY-MM-DD` | Meal energy events for an IST day |
| `GET` | `/sync/energy` | Today's Chef drain/energy preset for Decide |
| `POST` | `/sync/export` | Encrypted export payload for Settings |
| `POST` | `/sync/import` | Import pantry/grocery/history payload |
| `GET` | `/nutrition/summary?days=7` | Keyword macro/micronutrient averages, RDA gaps, suggestions |
| `GET` | `/plan/week` | Lightweight weekly meal plan strip |

## Vision And Agent

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/vision/parse` | Parse order screenshots or ingredient photos; requires `GROQ_API_KEY` |
| `POST` | `/agent/chat` | SSE native Chef chat agent; requires `GROQ_API_KEY` |

## Notifications

The canonical notifications API is `/api/notifications`. Legacy unprefixed `/notifications` aliases remain mounted so older installed PWAs can keep working, but new frontend code and cron jobs should use `/api/notifications`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications/vapid-public-key` | Public VAPID key |
| `GET` | `/api/notifications/subscriptions` | Enabled subscriptions for current user |
| `POST` | `/api/notifications/subscriptions` | Upsert current device push subscription |
| `DELETE` | `/api/notifications/subscriptions` | Disable current device by endpoint |
| `GET` | `/api/notifications/settings` | Reminder settings |
| `PUT` | `/api/notifications/settings` | Update reminder settings |
| `GET` | `/api/notifications/reminder-settings` | Canopy-compatible alias for reminder settings |
| `PUT` | `/api/notifications/reminder-settings` | Canopy-compatible alias for updating reminder settings |
| `POST` | `/api/notifications/reminder/{morning\|afternoon\|evening}` | Cron endpoint; requires `Authorization: Bearer <REMINDER_CRON_SECRET>` |

## Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Runtime health check |
| `GET` | `/api/health` | Vercel/GitHub Pages smoke-check alias |
