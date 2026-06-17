"""Groq-assisted semantic rerank for recipe search (no embeddings API)."""
from __future__ import annotations

import json
import logging
import os
import re

from app.schemas import RecipeResponse

logger = logging.getLogger(__name__)

_RANK_MODEL = "llama-3.1-8b-instant"


def groq_rerank_recipes(query: str, candidates: list[RecipeResponse], limit: int = 12) -> list[RecipeResponse]:
    """Ask Groq to order recipe IDs by relevance to the query. Falls back to input order."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key or not query.strip() or len(candidates) <= 1:
        return candidates[:limit]

    pool = candidates[:20]
    catalog = [
        {
            "i": idx,
            "name": r.name,
            "cuisine": r.cuisine or "",
            "match_pct": r.pantry_match_pct,
        }
        for idx, r in enumerate(pool)
    ]
    prompt = (
        f'User search: "{query.strip()}"\n'
        f"Recipes JSON: {json.dumps(catalog)}\n"
        "Return ONLY a JSON array of index numbers (field i) best matching the search, most relevant first. Max 12."
    )
    try:
        from groq import Groq

        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model=_RANK_MODEL,
            messages=[
                {"role": "system", "content": "You rank recipes by semantic relevance. Output valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=128,
            temperature=0,
        )
        text = (resp.choices[0].message.content or "").strip()
        match = re.search(r"\[[\d,\s]+\]", text)
        if not match:
            return candidates[:limit]
        indices = json.loads(match.group())
        ranked: list[RecipeResponse] = []
        seen: set[int] = set()
        for raw_i in indices:
            i = int(raw_i)
            if 0 <= i < len(pool) and i not in seen:
                seen.add(i)
                ranked.append(pool[i])
        for idx, r in enumerate(pool):
            if idx not in seen:
                ranked.append(r)
        return ranked[:limit]
    except Exception as exc:
        logger.warning("groq_rerank_recipes failed: %s", exc)
        return candidates[:limit]
