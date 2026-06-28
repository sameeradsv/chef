# Chef Docs

These docs are intentionally compact. The root [README](../README.md) is the quick start; the files here hold the details that still need to be maintained.

| Doc | Purpose |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Current backend/frontend architecture, data semantics, decision engine, AI boundaries |
| [API.md](./API.md) | REST endpoint reference |
| [OPERATIONS.md](./OPERATIONS.md) | Deployment, migrations, environment variables, reminders, external integrations |
| [DECISIONS.md](./DECISIONS.md) | Product decisions, shipped work, deferred scope |

## Invariants

- Chef is a deterministic kitchen decision engine first; LLMs explain, parse, and assist, but do not own inventory math or scoring.
- All user-facing datetimes are naive IST strings. Database datetimes are stored as naive UTC.
- Schema changes use additive migrations in `backend/app/database.py`; every new table or column needs its own named `MIGRATIONS` entry.
- Production uses Neon PostgreSQL and Vercel Python Functions. Local dev defaults to SQLite.
- Swiggy/Zomato live integration and pgvector are deferred until real APIs/infrastructure exist.
