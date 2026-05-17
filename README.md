# Chef

A kitchen **decision intelligence** system: manage inventory, reduce waste, and decide between **cooking, ordering, or eating out** — with honest cost, time, and effort tradeoffs.

Chef answers *“What is the best food decision right now?”* — not only *“What recipe do you want?”*

## Documentation

- Agent entry: [docs/AGENTS.md](docs/AGENTS.md)
- Doc index: [docs/README.md](docs/README.md)
- Decision engine: [docs/DECISION_ENGINE.md](docs/DECISION_ENGINE.md)
- API spec: [docs/API.md](docs/API.md)

## Architecture

```text
frontend/ (Next.js + React + TypeScript + Tailwind)
    ↓ REST
backend/  (FastAPI + SQLAlchemy)
    ↓
Decision Engine (deterministic scoring)
    ↓
Inventory + Seed Recipes + Stub Restaurants
```

| Layer | Status |
|-------|--------|
| Ingredient CRUD + freshness/expiry math | Implemented (server-side) |
| Decision engine (cook / order / eat out) | Implemented (deterministic) |
| Recipe recommend/search | Implemented (seed JSON + keyword filter) |
| Restaurant comparison | Stub seed data (no Swiggy/Zomato API) |
| LLM explanations | Stubbed — reasoning from score breakdown |
| pgvector semantic search | Stubbed — keyword search only |
| PostgreSQL | Optional via `docker-compose.yml`; **MVP uses SQLite** |

## Prerequisites

- Python 3.11+
- Node.js 18+

## Quick start (SQLite — default)

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

Database file: `backend/data/chef.db` (created on first run with sample pantry).

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local   # optional; defaults to http://localhost:8000
npm install
npm run dev
```

App: http://localhost:3000

## Optional: PostgreSQL

```bash
docker compose up -d postgres
```

Set before starting the backend:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://chef:chef@localhost:5432/chef"

# macOS/Linux
export DATABASE_URL=postgresql://chef:chef@localhost:5432/chef
```

Then run migrations implicitly via `Base.metadata.create_all` on startup. pgvector is not wired in MVP.

## Project structure

```text
chef/
  backend/
    app/           # FastAPI routes, decision engine, services
    data/          # SQLite DB, seed_recipes.json, seed_restaurants.json
  frontend/
    src/app/       # Dashboard, Pantry, Decide, Recipe pages
  docker-compose.yml
  docs/
```

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — expiring items, meal recommendation, quick recipes |
| `/inventory` | Pantry CRUD, storage filters, expiry badges |
| `/decision` | Cook vs order vs eat out with factor breakdown |
| `/recipe/[id]` | Recipe detail, pantry usage, rule-based substitutions |

## API (MVP)

| Method | Path |
|--------|------|
| GET/POST | `/ingredients` |
| PUT/DELETE | `/ingredients/{id}` |
| GET | `/recipes/recommend`, `/recipes/search`, `/recipes/{id}` |
| POST | `/user/state` |
| GET | `/user/preferences` |
| POST | `/decision/cook-vs-order`, `/decision/recommend-meal` |

## Stubbed vs implemented

**Fully implemented**

- Deterministic decision scoring per [docs/DECISION_ENGINE.md](docs/DECISION_ENGINE.md)
- Freshness score and expiry urgency from dates (no LLM)
- Ingredient normalization (dictionary + aliases)
- CORS for local frontend
- Seed pantry, recipes, and restaurant options

**Stubbed / MVP scope**

- LLM narrative explanations (uses structured reasoning bullets instead)
- Swiggy/Zomato APIs (seed restaurant DTOs only)
- pgvector / semantic embeddings (keyword `q` search on recipes)
- TheMealDB / Spoonacular live fetch (local `seed_recipes.json`)
- Auth / multi-user (single local user state row)

## Health check

```bash
curl http://localhost:8000/health
```
