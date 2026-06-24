# Chef

A kitchen **decision intelligence** system: manage your pantry, track food waste, and decide between **cooking, ordering, or eating out** — with honest cost, time, and effort tradeoffs.

Chef answers *"What is the best food decision right now?"* — not only *"What recipe do you want?"*

**Live:** [sameeradsv.github.io/chef](https://sameeradsv.github.io/chef) · API on Vercel  
**Demo account:** `demo` / `demo1234` — visible in the login UI only when `NEXT_PUBLIC_SHOW_DEMO=true` is set on the frontend.

---

## Features

| Feature | Status |
|---------|--------|
| Pantry CRUD with freshness/expiry scoring | Implemented |
| Barcode scanner → auto-fill ingredient from product | Implemented — uses rear camera, Open Food Facts lookup |
| Add ingredients from photo (vision AI) | Implemented |
| Discard log + food waste tracker | Implemented |
| Decision engine — cook vs order vs eat out | Implemented (deterministic scoring) |
| Cooking skill + missing ingredient cost in scoring | Implemented |
| Time-of-day energy inference | Implemented |
| Cross-app energy sync (Cortex / Circuit / Canopy) | Implemented |
| Recipe recommendations + pantry match % | Implemented |
| Recipe search (keyword + TheMealDB live results) | Implemented |
| Grocery list with AI suggestions | Implemented |
| Decision history + satisfaction ratings | Implemented |
| Log history from order screenshot (vision AI) | Implemented |
| User preferences (cuisines, spice, dietary, skill) | Implemented |
| LLM narrative explanations | Implemented (Groq Llama 3.1; requires `GROQ_API_KEY`) |
| Multi-user auth (JWT, PBKDF2-SHA256 100k iterations, 30-day tokens) | Implemented |
| WebAuthn passkey / biometric sign-in | Implemented — enable from **Settings → Security** |
| Live Swiggy/Zomato API | Stub (seed restaurant data only) |
| pgvector semantic search | Stub (keyword search only) |

---

## Architecture

```text
frontend/  Next.js 15 · React 19 · TypeScript · Tailwind CSS
               ↓ REST / Bearer JWT
backend/   FastAPI · SQLAlchemy 2.0 · Pydantic 2
               ↓
        Decision Engine (deterministic scoring)
        Services: freshness · recipes · normalize · barcode · vision
               ↓
        Neon PostgreSQL (prod) / SQLite (local dev)
```

---

## Quick start

### Prerequisites

- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs  
DB file: `backend/data/chef.db` (SQLite, auto-created with seed data on first run)

Optional env vars:

```bash
GROQ_API_KEY=...           # enables LLM narratives, vision parsing, and /chat agent
DATABASE_URL=postgres://   # switches from SQLite to PostgreSQL

# WebAuthn (passkey login) — set these in production
WEBAUTHN_RP_ID=your-domain.com
WEBAUTHN_ORIGIN=https://your-domain.com
WEBAUTHN_RP_NAME=chef
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # defaults to http://localhost:8000
npm install
npm run dev
```

App: http://localhost:3000

Optional env vars (set in `frontend/.env.local` or as GitHub Actions variables):

```bash
NEXT_PUBLIC_CORTEX_URL=http://...              # Cortex auth (cross-app SSO + energy sync)
NEXT_PUBLIC_CIRCUIT_API_URL=http://...         # Circuit backend (combined energy timelines)
NEXT_PUBLIC_CANOPY_API_URL=http://...          # Canopy backend (combined energy timelines)
NEXT_PUBLIC_SHOW_DEMO=true                     # show "Try the demo" button on the login page (off by default)
```

See [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md#cross-app-energy) for how Decide presets energy: local Chef accounts use Chef `/sync/energy`; Cortex accounts can use the Canopy-style combined Circuit + Canopy + Chef total.

---

## Optional: PostgreSQL via Docker

```bash
docker compose up -d postgres
```

```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://chef:chef@localhost:5432/chef"
# macOS/Linux
export DATABASE_URL=postgresql://chef:chef@localhost:5432/chef
```

---

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — expiring items, mood-aware recommendation, quick recipes, week glance strip (IST calendar week) |
| `/inventory` | Pantry CRUD, barcode/photo add, expiry badges, discard + waste log |
| `/decision` | Cook vs order vs eat out — Chef/Cortex energy preset, session overrides, log decision, score waterfall |
| `/recipe` | Recipe browse — list + pantry coverage scatter chart |
| `/recipe/[id]` | Recipe detail, pantry match, substitutions, interactive cooking steps |
| `/grocery` | Grocery list — add/buy/delete, AI suggestions |
| `/history` | Decision log — Week/Month/Year/All filters, pagination, IST datetime picker, auto-fill from screenshot |
| `/health` | Nutrition health — macro rings, per-nutrient RDA status, meal-type food suggestions |
| `/chat` | Terminal chat — ask "What should I cook?", "Should I order tonight?", "Log that I ate sushi" |
| `/settings` | Cuisines, spice, dietary, cooking skill, decision defaults (cooking mood), biometric sign-in |

---

## API

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login → JWT token |
| DELETE | `/auth/logout` | Invalidate current session (requires Bearer token) |
| GET | `/auth/me` | Current user info |
| GET | `/auth/status` | Whether any users exist (`has_users`) |
| POST | `/auth/webauthn/register/begin` | Start passkey registration (requires Bearer token) |
| POST | `/auth/webauthn/register/complete` | Finish passkey registration |
| POST | `/auth/webauthn/login/begin` | Start passkey login |
| POST | `/auth/webauthn/login/complete` | Finish passkey login → JWT token |

### Ingredients
| Method | Path | Description |
|--------|------|-------------|
| GET | `/ingredients` | List pantry (filter by storage, expiring\_soon) |
| POST | `/ingredients` | Add ingredient |
| PUT | `/ingredients/{id}` | Update ingredient |
| DELETE | `/ingredients/{id}` | Delete ingredient |
| POST | `/ingredients/{id}/discard` | Move to waste log (reason: expired/spoiled/other) |
| GET | `/ingredients/discarded` | Waste log history |
| GET | `/ingredients/waste-summary` | Most-wasted items with cost totals |
| GET | `/ingredients/barcode/{barcode}` | Lookup product by barcode |

### Recipes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/recipes/recommend` | Top recipes by pantry match |
| GET | `/recipes/search?q=&cuisine=` | Keyword search + TheMealDB |
| GET | `/recipes/{id}` | Recipe detail |

### Decision
| Method | Path | Description |
|--------|------|-------------|
| POST | `/decision/cook-vs-order` | Score cook vs order vs eat out |
| POST | `/decision/recommend-meal` | Full meal recommendation |

### User
| Method | Path | Description |
|--------|------|-------------|
| GET | `/user/state` | Current energy/mood state |
| POST | `/user/state` | Update state |
| GET | `/user/preferences` | Cuisine/dietary preferences |
| PUT | `/user/preferences` | Update preferences |

### Grocery
| Method | Path | Description |
|--------|------|-------------|
| GET | `/grocery` | Grocery list |
| POST | `/grocery` | Add item |
| PUT | `/grocery/{id}` | Mark bought / update quantity |
| DELETE | `/grocery/{id}` | Remove item |
| GET | `/grocery/suggestions` | AI-suggested items based on pantry gaps |

### History
| Method | Path | Description |
|--------|------|-------------|
| GET | `/history` | Decision log — `limit`, `offset`, `from_date`/`to_date` (IST), `date`; `include_summary=true` for paginated response with stats |
| POST | `/history` | Log a decision (`timestamp` = naive IST meal time) |
| PATCH | `/history/{id}` | Edit entry |
| DELETE | `/history/{id}` | Delete entry |

All datetime fields in API responses are **naive IST** (`YYYY-MM-DDTHH:MM:SS`); the backend stores UTC internally.

### Vision
| Method | Path | Description |
|--------|------|-------------|
| POST | `/vision/parse` | Parse screenshot or photo → pre-fill form fields |

### Energy
| Method | Path | Description |
|--------|------|-------------|
| GET | `/energy/timeline` | Per-meal energy events for a calendar day (`?date=YYYY-MM-DD`, default today IST) |
| GET | `/sync/energy` | Today's cumulative decision drain + meals detail |

### Nutrition
| Method | Path | Description |
|--------|------|-------------|
| GET | `/nutrition/summary` | Macro/micronutrient daily averages + RDA gap analysis + food suggestions (`?days=7`) |

### Health check
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{"status":"ok","service":"chef-api"}` — used by the login page connectivity probe |
| GET | `/api/health` | Same health response, used by Vercel/GitHub Pages deployment smoke checks |

---

## Decision scoring

The engine scores three modes deterministically — no LLM in the loop:

```
cook_score  = pantry_urgency + health + cost_savings − effort − cleanup − skill_gap − missing_ingredient_cost
order_score = convenience + craving_match − delivery_delay − budget_penalty
out_score   = eat_out_appeal − travel_time_cost − budget_penalty
```

Key factors:
- **Expiring ingredients** get a +2 cook bonus
- **Missing ingredients** penalise the cook score by ~₹45 each + sourcing effort
- **Cooking skill gap** (`difficulty − skill`) penalises cook score by 1.5× per gap point
- **Energy on Decide** — local Chef accounts preset from Chef `/sync/energy`; Cortex accounts preset from combined Circuit + Canopy + Chef timeline (same as Canopy Energy page); override per session; cooking mood default from Settings

---

## Deploy

### GitHub Pages + Vercel

1. **Vercel backend:** create a Vercel project from this repo with `backend` as the root directory, Framework Preset `Other`, Install Command `pip install -r requirements.txt`, and no custom build/output command. The backend entrypoint is `backend/api/index.py`.
2. **Vercel env vars:** set `DATABASE_URL` (Neon PostgreSQL), `CORS_ORIGINS=https://sameeradsv.github.io`, `INIT_DB_ON_STARTUP=false` after the production schema exists, and optionally `GROQ_API_KEY`, `CORTEX_AUTH_URL`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, and `WEBAUTHN_RP_NAME`.
3. **Schema initialization/migrations:** local dev still initializes on startup. For production, run `DATABASE_URL="postgresql://..." python -m app.database` from `backend/` before deploying schema-dependent changes.
4. **GitHub variables:** Settings → Actions → Variables → `CHEF_API_URL` = Vercel API URL (no trailing slash). For cross-app energy on Decide, also set `NEXT_PUBLIC_CORTEX_URL`, `NEXT_PUBLIC_CIRCUIT_API_URL`, and `NEXT_PUBLIC_CANOPY_API_URL` (same names as Canopy/Circuit repos). Without those sibling URLs, Decide still presets energy from Chef `/sync/energy` for local Chef accounts.
5. Push to `main` — Vercel deploys the backend from Git, and GitHub Actions verifies `CHEF_API_URL/api/health`, builds the frontend static export, and deploys it to Pages.

The frontend is exported as a static site with `basePath: "/chef"` and deployed to `https://sameeradsv.github.io/chef/`.

### PWA / mobile

Open the GitHub Pages URL in Safari (iOS) or Chrome (Android) and install from the browser menu. Works offline for cached screens.

---

## Project structure

```text
chef/
  backend/
    app/
      routers/      # ingredients, recipes, decision, user, grocery, history, vision, auth,
                    # webauthn, energy, sync, nutrition
      services/     # decision_engine, freshness, recipes, normalize, barcode, llm,
                    # health, personalization, restaurants, grocery, mealdb
      models.py     # SQLAlchemy ORM (Ingredient, UserState, UserPrefs, CookingHistory,
                    # GroceryItem, DiscardedIngredient, AuthSession, WebAuthnCredential/Challenge)
      schemas.py    # Pydantic request/response types
      tz_utils.py   # IST ↔ UTC conversion for all API datetimes
      database.py   # session factory; run_pending_migrations() (schema_migrations registry)
    data/           # seed_recipes.json, seed_restaurants.json
  frontend/
    src/
      app/          # Next.js pages (/, /inventory, /decision, /recipe, /recipe/[id],
                    # /grocery, /history, /health, /chat, /settings, /login)
      components/   # Layout (collapsible mobile side rail + desktop sidebar), AuthWrapper,
                    # BarcodeScanner, Card,
                    # DecisionScoreWaterfall, RecipeCoverageScatter, TerminalChat
      lib/          # api.ts (typed fetch), tz.ts (IST), cross-app-energy.ts (energy preset), utils.ts
      contexts/     # AuthContext
  docs/             # Architecture, decision engine, API, data models, roadmap, DEFERRED.md
  backend/vercel.json  # Vercel Python Function config
  docker-compose.yml
```

---

## Conduit integration

Chef's backend is consumed by **Conduit** — the hub app that provides cross-app AI chat and diary routing.

- **Agent reads:** `GET /recipes/recommend`, `POST /decision/cook-vs-order`, `GET /history` — Conduit answers "What should I cook?" and "Should I order tonight?"
- **Diary writes:** `POST /history` — Conduit's diary mode logs meals from freeform entries

Chef also has an embedded terminal chat at `/chat` (in the side navigation), powered by Chef's native Groq agent at `POST /agent/chat`. Requires `GROQ_API_KEY` on the Chef backend and `NEXT_PUBLIC_API_URL` on the frontend. No Conduit dependency for in-app chat.

Chef login also supports **Cortex** single sign-on (shared account across Chef, Canopy, Circuit). Set `NEXT_PUBLIC_CORTEX_URL` plus `NEXT_PUBLIC_CIRCUIT_API_URL` and `NEXT_PUBLIC_CANOPY_API_URL` for combined energy on the Decide page. Local Chef accounts use Chef `/sync/energy` as the fallback preset. Each backend needs `CORTEX_AUTH_URL` in its Vercel environment.

---

## Docs

- [Deferred & future work](docs/DEFERRED.md) — ecosystem backlog (master in Circuit repo)
- [DECISIONS.md](docs/DECISIONS.md) · [ROADMAP.md](docs/ROADMAP.md) · [INTEGRATIONS.md](docs/INTEGRATIONS.md)

---

## Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"chef-api"}
```
