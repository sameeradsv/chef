# Deferred & future work

**Last updated:** 2026-06-17  
**Canonical copy:** [Circuit `docs/DEFERRED.md`](https://github.com/sameeradsv/circuit/blob/main/docs/DEFERRED.md)

## BLOCKED (Chef)

| Item | Notes |
|------|--------|
| Swiggy / Zomato APIs + deep links | [INTEGRATIONS.md](./INTEGRATIONS.md) |
| Spoonacular, Edamam | Not provisioned |
| Native pgvector | Groq rerank shipped |
| Platform live pricing | Logged-meal trends shipped instead |
| Connected services | Deferred until real delivery APIs |

## Shipped (2026-06-17)

- `GET /decision/cost-insights` + Decide spend-trends card
- `GET /plan/week` + Home meal-plan strip
- `POST /sync/export` + `/sync/import` (Settings → Data)
- Decide predict history card (prior polish pass)
- Pantry FAB layout fix — `lg:hidden` breakpoint + `pb-[260px]` list clearance (landscape visibility + portrait occlusion)
- Grocery restock from use/discard — opt-out checkbox in `ConsumeSheet` + `DiscardSheet`; calls `POST /grocery` on confirm
- Decision engine pantry urgency fix — `recipe_pantry_expiry_urgency` scopes expiry urgency to ingredients the recipe actually uses (`in_pantry=True`), not the whole pantry
