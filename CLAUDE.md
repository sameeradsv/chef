# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chef is a kitchen decision intelligence system that answers "What is the best food decision right now?" by comparing cooking at home vs. ordering vs. eating out using a deterministic scoring engine (not AI/LLM-driven).

- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS — deployed to GitHub Pages as a static export
- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic 2 — deployed to Render (free tier); database is **Neon PostgreSQL** (free tier, external, set via `DATABASE_URL` in Render dashboard)

## Commands

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
npm run build                   # Generates PWA icons then builds
npm run lint
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` (see `.env.local.example`).

### Optional PostgreSQL (via Docker)

```bash
docker compose up -d postgres
# Then set DATABASE_URL env var before starting the backend
```

## Architecture

### Backend (`backend/app/`)

| File | Responsibility |
|---|---|
| `main.py` | FastAPI app init, lifespan hook, router registration, CORS; `run_pending_migrations()` + async seed on startup |
| `models.py` | SQLAlchemy ORM: `Ingredient`, `UserState`, `UserPreferences`, `CookingHistory`, `GroceryItem`, `DiscardedIngredient`, `AuthSession`, `WebAuthnCredential`, `WebAuthnChallenge` |
| `schemas.py` | Pydantic request/response types |
| `tz_utils.py` | IST wall-clock ↔ naive UTC conversion for all API datetimes |
| `database.py` | DB session factory; SQLite default, PostgreSQL via `DATABASE_URL`; additive migrations via `run_pending_migrations()` |
| `seed.py` | Populates `data/seed_recipes.json` + `data/seed_restaurants.json` on first run (background thread — does not block request acceptance) |

**Routers**:
- `/ingredients` (CRUD), `/recipes/recommend|search/{id}`, `/decision/cook-vs-order|recommend-meal`, `/user/state|preferences (GET+PUT)`, `/grocery` (CRUD + suggestions), `/history` (log+list+patch+delete), `/auth/register|login|me`, `/health`
- `/history` list — `limit`, `offset`, `from_date`/`to_date` (IST meal-time range), `date` (`today` or `YYYY-MM-DD`); `include_summary=true` → `{ items, total, offset, limit, summary }`; omit for plain array (Conduit-compatible)
- `/energy/timeline` — cumulative meal-energy timeline per day. Each event has `delta` (signed: good meals restore, skipped/bad drain), `running_energy`, `start_energy` (0.70), `end_energy`. Satisfaction-weighted delta: 4–5/5 → +0.08 to +0.10 (genuine restore); 3/5 → +0.02; 1–2/5 → negative; skipped window → breakfast −0.15, lunch −0.20, dinner −0.12. Decision-type fallback (no satisfaction): eat_out +0.03, order 0.0, cook −0.04. `energy` compat field (0–1) preserved for chart dot colour.
- `/sync/energy` — today's cumulative drain: logged-meal drain (cook 0.12, eat_out 0.07, order 0.03) + biological skip drain for closed windows with no entry (breakfast 0.20, lunch 0.25, dinner 0.15). Having any meal always drains less than skipping it. Consumed by the decision page for all accounts (not just Cortex) to pre-fill `energy_level`.
- `/nutrition/summary` — keyword-based macro/micronutrient averages + RDA gap analysis + food suggestions
- `/vision/parse` — image-to-meal/ingredient parsing via Groq Llama 4 Scout
- `/agent/chat` — native Groq chat agent (SSE); tools: meal recommendations, cook-vs-order, food log, log meal. Requires `GROQ_API_KEY`; model override via `CHEF_AGENT_MODEL`
- `/auth/webauthn/register/begin|complete` (Bearer), `/auth/webauthn/login/begin|complete` (public, returns JWT)

**Database migrations** (no Alembic): additive `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` only. On lifespan startup, `run_pending_migrations()` in `database.py` loads applied names from `schema_migrations` in one query, then runs only pending entries from `MIGRATIONS`. Warm boots skip schema inspection entirely. **Each new column or table must be registered as its own named migration** in `MIGRATIONS` — do not only append to `_migrate_sqlite` / `_migrate_postgres`, or production will skip it once the coarse `sqlite_schema` / `postgres_schema` rows exist.

**Services** (the core logic):
- `decision_engine.py` — Deterministic scoring: cook score = `pantry_urgency + health + cost_savings − effort_cost − cleanup`; order score = `convenience + craving_match − delivery_delay − budget_penalty`; eat-out score similar with travel time (~25 min). When the primary venue is dine-in-only, order scoring uses a separate delivery pick (`order_restaurant` in `compare_options`). Expiring-ingredient bonus: +2 for cook. Energy-aware restaurant selection.
- `freshness.py` — `compute_freshness_score(expiry_date, buy_date, opened)` → 0–10; `compute_expiry_urgency(expiry_date)` → 0–10
- `recipes.py` — Recipe matching against pantry inventory + ingredient substitutions; history-aware recommendations
- `normalize.py` — Ingredient name normalization before DB storage
- `health.py` — Keyword-based nutrition estimation (`estimate_meal_nutrition`), daily RDA averages (`analyze_history`), gap-driven food suggestions (`build_suggestions`)
- `personalization.py` — `get_user_profile`: analyzes last 30 history entries + stored prefs to derive favorite cuisines, cook frequency, weekday patterns
- `barcode.py` — Open Food Facts API (`world.openfoodfacts.org`) lookup; parses quantity/unit from product data
- `restaurants.py` — Seed/history/AI restaurant pools; `pick_restaurants_for_decision` returns primary + delivery venue; `delivery_available` inferred from order vs eat-out history, dine-in name heuristics, and user overrides (`restaurant_delivery_json` on preferences, set from History log/edit); energy-aware fast-food option injection
- `grocery.py` — Grocery suggestion logic
- `llm.py` — Groq Llama 3.1 8B narrative explanations (requires `GROQ_API_KEY`)
- `chef_agent.py` — Groq tool-calling stream for `/agent/chat` (requires `GROQ_API_KEY`)
- `mealdb.py` — TheMealDB live recipe search; wired into `/recipes/search` alongside seed data

**`CookingHistoryModel` field semantics**: `timestamp` = the meal's actual date/time (user-specified, defaults to insert time if omitted); `created_at` = DB insert time (always entry time). Both are stored as naive UTC in the DB; API responses serialize them as **naive IST strings** (`YYYY-MM-DDTHH:MM:SS`). Energy and nutrition endpoints filter by `timestamp` so backdated entries land on their original date, not today.

**Timezone contract**: All user-facing API datetimes are naive IST on the wire. The frontend displays and collects IST only (`frontend/src/lib/tz.ts`); `tz_utils.py` converts to/from naive UTC at the backend boundary.

Data is multi-user — all tables keyed by `user_id`. JWT auth (30-day tokens, bcrypt passcodes). Demo account: `demo` / `demo1234`.

### Frontend (`frontend/src/`)

| Path | Responsibility |
|---|---|
| `app/layout.tsx` | Root layout wrapped in `<AuthWrapper>` |
| `app/page.tsx` | Dashboard — expiring items, recommendations, `WeekGlance` strip, `ThemeToggle` |
| `app/inventory/page.tsx` | Pantry CRUD |
| `app/decision/page.tsx` | Cook vs order vs eat out comparison UI |
| `app/recipe/page.tsx` | Recipe browse + `RecipeCoverageScatter` pantry coverage chart |
| `app/recipe/[id]/page.tsx` | Recipe detail with pantry ingredient usage and interactive cooking steps |
| `app/grocery/page.tsx` | Grocery list — add/buy/delete items + AI suggestions |
| `app/history/page.tsx` | Decision history — IST datetime picker, Week/Month/Year/All filters (server-side by meal `timestamp`), pagination (20/page), edit/delete, satisfaction ratings; screenshot-to-log via vision API |
| `app/health/page.tsx` | Nutrition health — macro rings (SVG), per-nutrient RDA bars, meal-type-keyed food suggestions |
| `app/chat/page.tsx` | Terminal-style chat UI — native Groq agent via `POST /agent/chat` (`<TerminalChat>`) |
| `app/settings/page.tsx` | User preferences — cuisines, spice level, dietary |
| `app/login/page.tsx` | Login / register; pings `/health` to check backend reachability |
| `lib/api.ts` | Typed fetch wrapper; all API types live here; reads `NEXT_PUBLIC_API_URL` |
| `lib/tz.ts` | IST-only display/input helpers — naive IST strings from API; no client-side UTC conversion |
| `lib/utils.ts` | `expiryBadge`, `formatCurrency` helpers |
| `contexts/AuthContext.tsx` | JWT token state, login/register/logout, localStorage persistence |
| `components/` | `Layout.tsx` (nav — 8 tabs: Home/Pantry/Decide/Grocery/History/Health/Chat/You), `AuthWrapper.tsx`, `Card.tsx`, `DecisionCard.tsx`, `TerminalChat.tsx`, `BarcodeScanner.tsx` |

Custom Tailwind color tokens are defined as CSS variables (`--kitchen-bg`, `--kitchen-accent`, `--kitchen-warn`, etc.) in `globals.css`.

### Deployment

- **Frontend**: GitHub Actions builds `next export` (static) with `basePath: "/chef"`, deploys to GitHub Pages. PWA is disabled in dev and on GitHub Pages build.
- **Backend**: Render Blueprint (`render.yaml`) — Python 3.12, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; health check path `/health`. Database is **Neon PostgreSQL** (free tier, external) — set `DATABASE_URL` manually in Render dashboard after deploy. Set `GROQ_API_KEY` manually in Render dashboard to enable LLM narratives, vision parsing, and chat agent. Set `ANTHROPIC_API_KEY` to enable recipe generation.
- **CI/CD** (`.github/workflows/deploy.yml`): `CHEF_API_URL` repo Actions variable sets the backend URL baked into the frontend build. `RENDER_DEPLOY_HOOK` secret triggers backend redeploy.

### Stubbed / Not Yet Implemented

These are in-scope future features still using placeholder/seed data:
- Live Swiggy/Zomato API integration (uses `seed_restaurants.json` — seed data only)
- pgvector semantic search (keyword `q` filter only; needs PostgreSQL + pgvector extension)

### Implemented but needs configuration
- **LLM narrative explanations** — `services/llm.py` calls Groq Llama 3.1 8B; requires `GROQ_API_KEY` set in Render dashboard
- **Chat agent** — `routers/agent.py` + `services/chef_agent.py`; Groq Llama 3.3 70B with tool calling; requires same `GROQ_API_KEY`
- **Vision / screenshot parsing** — `routers/vision.py` calls Groq Llama 4 Scout (`meta-llama/llama-4-scout-17b-16e-instruct`); requires same `GROQ_API_KEY`. Used by history page screenshot-to-log feature.
- **Recipe generation** — `services/mealdb.py:generate_recipes()` calls Anthropic Claude; requires `ANTHROPIC_API_KEY`. Without it, recipe suggestions silently return MealDB results only.
- **TheMealDB live search** — `services/mealdb.py` fetches live results; wired into `/recipes/search` alongside seed data
- **WebAuthn passkey / biometric sign-in** — `routers/webauthn.py`; requires `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_NAME` env vars in production. Endpoints: `POST /auth/webauthn/register/begin|complete` (requires Bearer token), `POST /auth/webauthn/login/begin|complete` (public, returns JWT). Frontend: `src/hooks/usePasskey.ts` + `PasskeyBanner` post-login prompt.

### Conscious Design Decisions (vs. Design Handoff)

The design handoff (`Claude Design/chef-designs/design_handoff_kitchen_intelligence/`) specified certain features that were deliberately **not implemented**. Do not re-add these without explicit approval:

| Feature | Decision | Reason |
|---|---|---|
| **Pantry theme** (third colour scheme) | Dropped | Only two themes (Hearth dark, Mise warm) are shipped; Pantry (cool neutral/blue) was cut as low-usage |
| **Density control** (compact/standard/comfy) | Dropped | The spacing multiplier adds complexity with negligible perceptible benefit at this scale |
| **Connected services** (Instacart, OpenTable, DoorDash, Apple Health) | Deferred | Re-enable once Swiggy/Zomato live API integration ships — the rows belong in Settings when real integrations exist |

### Open Design Gaps (tracked, not yet built)

| Feature | Notes |
|---|---|
| Grocery — swipe-to-mark-bought | `translateX(-72px)` swipe revealing amber "Mark bought"; currently uses checkboxes |

### Closed Design Gaps (implemented)

| Feature | Where |
|---|---|
| Bottom tab bar navigation | `components/Layout.tsx` — mobile bottom tabs + desktop sidebar |
| Week glance strip on Dashboard | `app/page.tsx` — `WeekGlance` component; fetches current IST calendar week (Mon–today) via `GET /history?from_date&to_date` |
| ThemePicker in Dashboard header | `app/page.tsx` — `ThemeToggle` compact swatch pills (top-right of greeting) |
| Tonight's Pick score badge | `app/page.tsx` — backdrop-blur amber pill showing mode + pantry match % |
| Add Ingredient — Voice mode | `app/inventory/page.tsx` — Manual / Voice switcher in `IngredientSheet`; Web Speech API |
| Recipe Method — interactive cooking steps | `app/recipe/[id]/RecipeClient.tsx` — "Begin cooking" CTA, active-step highlight, "Step done →" advance |
| Barcode Scanner — detected-product overlay | `components/BarcodeScanner.tsx` — full-screen camera, amber reticle, bottom confirm sheet with qty + storage |
| Nutrition / Health page | `app/health/page.tsx` — macro rings, per-nutrient RDA status, meal-type-keyed food suggestions; backed by `/nutrition/summary` |
| Chat page | `app/chat/page.tsx` + `components/TerminalChat.tsx` — native Groq agent (`POST /agent/chat`) |
| Recipe browse page | `app/recipe/page.tsx` — recipe list with pantry coverage scatter chart |

### Additions Beyond Design Spec

These components were built during implementation and are intentional additions not in the original design handoff:

- `components/DecisionScoreWaterfall.tsx` — horizontal bar chart breaking down score factors per decision mode; shown as collapsible section on the Decision page
- `components/RecipeCoverageScatter.tsx` — scatter/coverage visualisation for recipe pantry match; used on `app/recipe/page.tsx`
- `routers/energy.py` + `routers/sync.py` — cumulative meal-energy timeline (signed deltas, running balance, restorative good meals) and today's drain; consumed by cross-app energy integrations
- `routers/nutrition.py` + `services/health.py` — keyword-based macro/micronutrient analysis with RDA gap detection and Indian-diet-aware food suggestions
- `routers/vision.py` — Groq Llama 4 Scout image parser; powers screenshot-to-log on the history page
- `services/personalization.py` — user profile derived from cooking history; feeds history-aware meal recommendations
