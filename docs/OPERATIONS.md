# Operations

This doc covers deployment, migrations, environment variables, reminders, and external integration status.

## Local Development

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`.

Optional PostgreSQL:

```bash
docker compose up -d postgres
$env:DATABASE_URL="postgresql://chef:chef@localhost:5432/chef"
```

## Deployment

Frontend deploys through GitHub Actions to GitHub Pages as a static export with `basePath: "/chef"`.

Backend deploys from `backend/` to Vercel Python Functions. The production database is Neon PostgreSQL via `DATABASE_URL`.

Deployment flow:

1. Create the Vercel backend project with root `backend/`.
2. Set backend env vars, especially `DATABASE_URL`, `CORS_ORIGINS`, and optional AI/reminder/passkey vars.
3. Run production migrations explicitly with `python -m app.database` from `backend/`.
4. Keep `INIT_DB_ON_STARTUP=false` in production after schema initialization.
5. Set GitHub Actions variable `CHEF_API_URL` to the Vercel backend URL.
6. Push to `main`; the workflow verifies `/api/health`, bakes env vars into the static frontend, and deploys to Pages.

Do not add local dev origins to committed config defaults. Local origins belong in local env files only.

## Migrations

Chef does not use Alembic. `backend/app/database.py` owns additive migrations.

Rules:

- Use `Base.metadata.create_all()` for initial schema creation.
- Add each new table or column as its own named migration in `MIGRATIONS`.
- Do not only append logic to broad historical migrations such as `sqlite_schema` or `postgres_schema`; production may have already marked those names done.
- Migrations must be additive: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, and safe index creation.

Run locally or for production:

```bash
cd backend
$env:DATABASE_URL="postgresql://..."
python -m app.database
```

## Environment Variables

Backend:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection; defaults to local SQLite if absent |
| `CORS_ORIGINS` | Comma-separated deployed frontend origins |
| `INIT_DB_ON_STARTUP` | Startup schema/seed toggle; false in production after init |
| `GROQ_API_KEY` | Narratives, recipe generation, vision, chat |
| `CHEF_AGENT_MODEL` | Optional Groq model override for chat agent |
| `CORTEX_AUTH_URL` | Shared Cortex JWT validation |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `REMINDER_CRON_SECRET` | Cron endpoint bearer token |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_NAME` | Passkeys |

Frontend:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Chef backend |
| `NEXT_PUBLIC_CORTEX_URL` | Cortex auth and SSO |
| `NEXT_PUBLIC_CIRCUIT_API_URL` | Circuit energy timeline |
| `NEXT_PUBLIC_CANOPY_API_URL` | Canopy energy timeline |
| `NEXT_PUBLIC_SHOW_DEMO` | Shows demo button on login |

## Web Push Reminders

Chef supports three configurable daily meal-log reminders: morning, afternoon, and evening. Defaults are `11:00`, `15:00`, and `22:00` IST, and reminder settings accept only 30-minute boundaries. The `default_meal_log_reminder_times` migration updates existing rows that still match the previous defaults (`09:00`, `14:00`, `20:00`) without touching customized schedules.

Flow:

```mermaid
flowchart LR
  Device["Installed PWA"] -->|"PushManager.subscribe()"| API["Chef API"]
  API --> Subs["push_subscriptions"]
  API --> Settings["user_reminder_settings"]
  Cron["cron-job.org"] -->|"POST /api/notifications/reminder/type"| API
  API --> Log["reminder_dispatch_log"]
  API --> Push["Browser push service"]
  Push --> SW["PWA service worker"]
  SW --> Device
```

Generate VAPID keys:

```bash
python -m pywebpush --vapid
```

Create three cron-job.org jobs, usually once every 30 minutes, aligned to `:00` and `:30`:

```text
POST https://your-chef-api.vercel.app/api/notifications/reminder/morning
POST https://your-chef-api.vercel.app/api/notifications/reminder/afternoon
POST https://your-chef-api.vercel.app/api/notifications/reminder/evening
Authorization: Bearer <REMINDER_CRON_SECRET>
```

The backend only sends when the current IST minute matches a user's configured time, and `reminder_dispatch_log` prevents duplicate sends. Notification times do not change skipped-meal drain windows; entries are still evaluated by their logged meal timestamp. Invalid push subscriptions are disabled on `404` or `410`.

## Cross-App Energy

Decide presets energy this way:

- Local Chef accounts call Chef `GET /sync/energy`.
- Cortex accounts merge today's timelines from Circuit, Canopy, and Chef.
- Circuit provides the opening balance via `start_energy`.
- Canopy and Chef contribute signed deltas up to the current moment.
- If Cortex validation or sibling calls fail, Chef falls back to `/sync/energy`.

Frontend env names intentionally match Canopy/Circuit:

```bash
NEXT_PUBLIC_CORTEX_URL=...
NEXT_PUBLIC_CIRCUIT_API_URL=...
NEXT_PUBLIC_CANOPY_API_URL=...
```

## External Integrations

Implemented:

- Open Food Facts barcode lookup.
- TheMealDB recipe search.
- Groq for narratives, generated recipes, vision, and chat.
- Cortex auth/energy ecosystem integration.

Deferred:

- Swiggy/Zomato live APIs. No unofficial SDKs or scraping should be added without explicit approval.
- Spoonacular/Edamam.
- Native pgvector semantic search.
- Full in-app ordering, connected-service rows, and live delivery pricing.
