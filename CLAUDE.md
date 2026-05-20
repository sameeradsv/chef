# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chef is a kitchen decision intelligence system that answers "What is the best food decision right now?" by comparing cooking at home vs. ordering vs. eating out using a deterministic scoring engine (not AI/LLM-driven).

- **Frontend**: Next.js 15 / React 19 / TypeScript / Tailwind CSS — deployed to GitHub Pages as a static export
- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic 2 — deployed to Render (free tier, **PostgreSQL** for persistent cross-device data)

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
| `main.py` | FastAPI app init, router registration, CORS, DB seed on startup |
| `models.py` | SQLAlchemy ORM: `Ingredient`, `UserState`, `UserPreferences` |
| `schemas.py` | Pydantic request/response types |
| `database.py` | DB session factory; SQLite default, PostgreSQL via `DATABASE_URL` env var |
| `seed.py` | Populates `data/seed_recipes.json` + `data/seed_restaurants.json` on first run |

**Routers**: `/ingredients` (CRUD), `/recipes/recommend|search/{id}`, `/decision/cook-vs-order|recommend-meal`, `/user/state|preferences (GET+PUT)`, `/grocery` (CRUD + suggestions), `/history` (log+list), `/auth/register|login|me`, `/health`

**Services** (the core logic):
- `decision_engine.py` — Deterministic scoring: cook score = `pantry_urgency + health + cost_savings − effort_cost − cleanup`; order score = `convenience + craving_match − delivery_delay − budget_penalty`; eat-out score similar with travel time (~25 min). Expiring-ingredient bonus: +2 for cook.
- `freshness.py` — `compute_freshness_score(expiry_date, buy_date, opened)` → 0–10; `compute_expiry_urgency(expiry_date)` → 0–10
- `recipes.py` — Recipe matching against pantry inventory + ingredient substitutions
- `normalize.py` — Ingredient name normalization before DB storage

Data is multi-user — all tables keyed by `user_id`. JWT auth (30-day tokens, bcrypt passcodes). Demo account: `demo` / `demo1234`.

### Frontend (`frontend/src/`)

| Path | Responsibility |
|---|---|
| `app/layout.tsx` | Root layout wrapped in `<AuthWrapper>` |
| `app/page.tsx` | Dashboard — expiring items, recommendations, quick recipe list |
| `app/inventory/page.tsx` | Pantry CRUD |
| `app/decision/page.tsx` | Cook vs order vs eat out comparison UI |
| `app/recipe/[id]/page.tsx` | Recipe detail with pantry ingredient usage |
| `app/grocery/page.tsx` | Grocery list — add/buy/delete items + AI suggestions |
| `app/history/page.tsx` | Decision history — log + satisfaction ratings |
| `app/settings/page.tsx` | User preferences — cuisines, spice level, dietary |
| `app/login/page.tsx` | Login / register |
| `lib/api.ts` | Typed fetch wrapper; all API types live here; reads `NEXT_PUBLIC_API_URL` |
| `lib/utils.ts` | `expiryBadge`, `formatCurrency` helpers |
| `contexts/AuthContext.tsx` | JWT token state, login/register/logout, localStorage persistence |
| `components/` | `Layout.tsx` (nav), `AuthWrapper.tsx`, `Card.tsx`, `DecisionCard.tsx` |

Custom Tailwind color tokens are defined as CSS variables (`--kitchen-bg`, `--kitchen-accent`, `--kitchen-warn`, etc.) in `globals.css`.

### Deployment

- **Frontend**: GitHub Actions builds `next export` (static) with `basePath: "/chef"`, deploys to GitHub Pages. PWA is disabled in dev and on GitHub Pages build.
- **Backend**: Render Blueprint (`render.yaml`) — Python 3.11, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Uses Render managed **PostgreSQL** (free tier, persists across deploys). Set `ANTHROPIC_API_KEY` manually in Render dashboard to enable LLM narratives.
- **CI/CD** (`.github/workflows/deploy.yml`): `CHEF_API_URL` repo Actions variable sets the backend URL baked into the frontend build. `RENDER_DEPLOY_HOOK` secret triggers backend redeploy.

### Stubbed / Not Yet Implemented

These are in-scope future features still using placeholder/seed data:
- Live Swiggy/Zomato API integration (uses `seed_restaurants.json` — seed data only)
- pgvector semantic search (keyword `q` filter only; needs PostgreSQL + pgvector extension)

### Implemented but needs configuration
- **LLM narrative explanations** — `services/llm.py` calls Claude Haiku 4.5; requires `ANTHROPIC_API_KEY` set in Render dashboard
- **TheMealDB live search** — `services/mealdb.py` fetches live results; wired into `/recipes/search` alongside seed data
