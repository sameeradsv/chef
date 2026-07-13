# Chef

Chef is a kitchen decision intelligence system. It helps answer "What is the best food decision right now?" by comparing cooking at home, ordering, and eating out with deterministic scoring for cost, effort, health, time, energy, and pantry expiry.

**Live:** [sameeradsv.github.io/chef](https://sameeradsv.github.io/chef)  
**Demo account:** `demo` / `demo1234` when `NEXT_PUBLIC_SHOW_DEMO=true`.

## Current State

| Area | Status |
| --- | --- |
| Pantry CRUD, expiry/freshness scoring, barcode lookup | Implemented |
| Pantry photo add and order screenshot parsing | Implemented via Groq vision |
| Cook vs order vs eat-out scoring | Implemented, deterministic core |
| Recipe recommendations and search | Implemented with seed data, TheMealDB, and optional Groq generation |
| Grocery list and suggestions | Implemented, including restock from use/discard and swipe-to-buy |
| History, satisfaction, spend stats, nutrition summary | Implemented, with prepared-by and travel-scoped memory |
| Cross-app energy preset with Cortex/Circuit/Canopy | Implemented |
| Native Chef chat agent | Implemented, requires `GROQ_API_KEY` |
| JWT auth, Cortex SSO, WebAuthn passkeys | Implemented |
| Web Push meal reminders | Implemented with VAPID + cron |
| Swiggy/Zomato live APIs, Spoonacular/Edamam | Deferred; seed/history restaurant data only |
| Native pgvector search | Deferred; keyword/Groq fallback only |

## Stack

```text
frontend/  Next.js 15, React 19, TypeScript, Tailwind CSS, static export
backend/   FastAPI, SQLAlchemy 2.0, Pydantic 2
database   SQLite for local dev, Neon PostgreSQL in production
ai         Groq for narratives, recipe generation, chat, and vision parsing
```

All user-facing API datetimes are naive IST strings. The backend stores naive UTC and converts at the API boundary.

## Quick Start

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

Frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

App: http://localhost:3000

Optional local PostgreSQL:

```bash
docker compose up -d postgres
$env:DATABASE_URL="postgresql://chef:chef@localhost:5432/chef"
```

## Key Environment

Backend:

```bash
DATABASE_URL=postgresql://...
GROQ_API_KEY=...
CORTEX_AUTH_URL=https://...
INIT_DB_ON_STARTUP=false
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
REMINDER_CRON_SECRET=...
WEBAUTHN_RP_ID=your-domain.com
WEBAUTHN_ORIGIN=https://your-domain.com
WEBAUTHN_RP_NAME=chef
```

Frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CORTEX_URL=https://...
NEXT_PUBLIC_CIRCUIT_API_URL=https://...
NEXT_PUBLIC_CANOPY_API_URL=https://...
NEXT_PUBLIC_SHOW_DEMO=true
```

## Main Routes

| Route | Purpose |
| --- | --- |
| `/` | Dashboard, expiring pantry, tonight pick, week glance, meal plan strip |
| `/inventory` | Pantry CRUD, barcode/photo add, use/discard, grocery restock |
| `/decision` | Cook/order/eat-out comparison, energy preset, overrides, rationale, predict and spend cards |
| `/recipe` and `/recipe/[id]` | Recipe browse, pantry coverage, detail, substitutions, cooking steps |
| `/grocery` | Grocery list, suggestions, swipe-to-mark-bought |
| `/history` | Meal log, filters, summary stats, screenshot-to-log, home/travel scope |
| `/health` | Nutrition averages, RDA gaps, food suggestions |
| `/chat` | Native Groq kitchen agent |
| `/settings` | Preferences, decision defaults, reminders, passkeys, data export/import |

## Docs

The detailed docs have been compressed into a smaller current set:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system design, data model, frontend surfaces, decision engine, AI boundaries
- [docs/API.md](docs/API.md) - REST endpoint reference
- [docs/OPERATIONS.md](docs/OPERATIONS.md) - deployment, migrations, environment, reminders, integrations
- [docs/DECISIONS.md](docs/DECISIONS.md) - product decisions, implemented milestones, deferred work

## Deploy

Frontend deploys to GitHub Pages as a static export with `basePath: "/chef"`. Backend deploys to Vercel from `backend/` with Neon PostgreSQL. Production schema changes should be applied explicitly:

```bash
cd backend
$env:DATABASE_URL="postgresql://..."
python -m app.database
```

Then keep `INIT_DB_ON_STARTUP=false` in Vercel once the schema exists.

## Health Check

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"chef-api"}
```
