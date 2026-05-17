# Chef — Agent bootstrap

**When to read this:** Tools that only load repo-root `AGENTS.md`—then follow links into `docs/`.

Kitchen **decision intelligence**: inventory, waste reduction, and cook vs order vs eat-out—optimized for cost, effort, health, and convenience.

## Read first

Full agent entry point: **[docs/AGENTS.md](docs/AGENTS.md)** (identity, priorities, AI boundaries, UX).

Doc index and reading order: **[docs/README.md](docs/README.md)**.

## Non-negotiables

- **Decision engine:** Chef should NOT rely entirely on AI. Use deterministic scoring first → [docs/DECISION_ENGINE.md](docs/DECISION_ENGINE.md).
- **AI limits:** Do not use AI for inventory counts, expiry calculations, scheduling logic, or deterministic calculations → [docs/AI.md](docs/AI.md).
- **MVP delivery:** Do NOT start with full Swiggy/Zomato integrations → [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
- **Moat:** Effort-aware decisions and tradeoff optimization—not generic recipe generation → [docs/FOUNDING_PRINCIPLES.md](docs/FOUNDING_PRINCIPLES.md).

## Quick map

| Topic | Doc |
|-------|-----|
| Schemas | [docs/DATA_MODELS.md](docs/DATA_MODELS.md) |
| REST API | [docs/API.md](docs/API.md) |
| Stack & layers | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Phases & MVP weeks | [docs/ROADMAP.md](docs/ROADMAP.md) |
| UI screens | [docs/FRONTEND.md](docs/FRONTEND.md) |

## Implementation notes for agents

- Start from [docs/README.md](docs/README.md) flowchart if scope is unclear.
- Cross-link docs; do not duplicate full JSON schemas outside [docs/DATA_MODELS.md](docs/DATA_MODELS.md).
- Documentation-only changes belong under `docs/` unless the user asks for application code.
