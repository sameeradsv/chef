# Chef

A kitchen **decision intelligence** system: manage your pantry, track food waste, and decide between **cooking, ordering, or eating out** — with honest cost, time, and effort tradeoffs.

Chef answers *"What is the best food decision right now?"* — not only *"What recipe do you want?"*

**Live:** [sameeradsv.github.io/chef](https://sameeradsv.github.io/chef) · API on Render (free tier — first request may take ~30s to wake up)  
**Demo account:** `demo` / `demo1234`

---

## Features

| Feature | Status |
|---------|--------|
| Pantry CRUD with freshness/expiry scoring | Implemented |
| Barcode scanner → auto-fill ingredient from product | Implemented |
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
| Multi-user auth (JWT, bcrypt, 30-day tokens) | Implemented |
| WebAuthn passkey / biometric sign-in | Implemented |
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
GROQ_API_KEY=...                      # enables LLM narratives and vision parsing
DATABASE_URL=postgres://              # switches from SQLite to PostgreSQL
NEXT_PUBLIC_CORTEX_URL=http://...     # Cortex backend URL for cross-app auth (optional)
NEXT_PUBLIC_CONDUIT_API_URL=http://...  # Conduit backend URL for /chat terminal (optional)

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
| `/` | Dashboard — expiring items, mood-aware recommendation, quick recipes |
| `/inventory` | Pantry CRUD, barcode/photo add, expiry badges, discard + waste log |
| `/decision` | Cook vs order vs eat out — factor breakdown, context sliders |
| `/recipe/[id]` | Recipe detail, pantry match, substitutions, link to compare |
| `/grocery` | Grocery list — add/buy/delete, AI suggestions |
| `/history` | Decision log, satisfaction ratings, auto-fill from screenshot |
| `/chat` | Terminal chat — ask "What should I cook?", "Should I order tonight?", "Log that I ate sushi" |
| `/settings` | Cuisines, spice level, dietary restrictions, cooking skill |

---

## API

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login → JWT token |
| GET | `/auth/me` | Current user info |
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
| GET | `/history` | Decision log |
| POST | `/history` | Log a decision |
| PATCH | `/history/{id}` | Edit entry |
| DELETE | `/history/{id}` | Delete entry |

### Vision
| Method | Path | Description |
|--------|------|-------------|
| POST | `/vision/parse` | Parse screenshot or photo → pre-fill form fields |

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
- **Energy** is inferred from time of day (6–9→7, 9–12→8, 12–15→6, 18–21→7, else→4) and overridden by cross-app Cortex data

---

## Deploy

### GitHub Pages + Render (current setup)

1. **Render backend:** New → Blueprint → connect repo → apply `render.yaml`. Set `DATABASE_URL` (Neon PostgreSQL) and optionally `GROQ_API_KEY` in Render dashboard.
2. **GitHub variable:** Settings → Actions → Variables → `CHEF_API_URL` = Render URL (no trailing slash).
3. **(Optional)** Render Deploy Hook URL → GitHub secret `RENDER_DEPLOY_HOOK`.
4. Push to `main` — GitHub Actions builds the frontend static export and deploys to Pages.

The frontend is exported as a static site with `basePath: "/chef"` and deployed to `https://sameeradsv.github.io/chef/`.

### PWA / mobile

Open the GitHub Pages URL in Safari (iOS) or Chrome (Android) and install from the browser menu. Works offline for cached screens.

---

## Project structure

```text
chef/
  backend/
    app/
      routers/      # ingredients, recipes, decision, user, grocery, history, vision, auth
      services/     # decision_engine, freshness, recipes, normalize, barcode, llm
      models.py     # SQLAlchemy ORM
      schemas.py    # Pydantic request/response types
      database.py   # session factory + migration helpers
    data/           # seed_recipes.json, seed_restaurants.json
  frontend/
    src/
      app/          # Next.js pages
      components/   # Layout, AuthWrapper, BarcodeScanner, Card
      lib/          # api.ts (typed fetch), utils.ts
      contexts/     # AuthContext
  docs/             # Architecture, decision engine, API, roadmap docs
  render.yaml       # Render deploy blueprint
  docker-compose.yml
```

---

## Conduit integration

Chef's backend is consumed by **Conduit** — the hub app that provides cross-app AI chat and diary routing.

- **Agent reads:** `GET /recipes/recommend`, `POST /decision/cook-vs-order`, `GET /history` — Conduit answers "What should I cook?" and "Should I order tonight?"
- **Diary writes:** `POST /history` — Conduit's diary mode logs meals from freeform entries

Chef also has an embedded terminal chat at `/chat` (in the sidebar and mobile bottom tab), powered by Conduit's backend with the `scope=chef` tool set. Set `NEXT_PUBLIC_CONDUIT_API_URL` in `frontend/.env.local` to point to the Conduit backend.

Chef login also supports **Cortex** single sign-on (shared account across Chef, Canopy, Circuit). Set `NEXT_PUBLIC_CORTEX_URL` for cross-app auth and energy sync.

---

## Health check

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"chef-api"}
```
