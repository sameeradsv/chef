from __future__ import annotations

import os
from typing import Any

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return None
        try:
            from groq import Groq
            _client = Groq(api_key=api_key)
        except Exception:
            return None
    return _client


def generate_meal_suggestion(meal_type: str, pantry_names: list[str], energy_level: int) -> str:
    """Return a one-sentence contextual suggestion for the given meal type. Returns '' if unavailable."""
    client = _get_client()
    if not client:
        return ""
    try:
        pantry_str = ", ".join(pantry_names[:8]) if pantry_names else "various ingredients"
        prompt = (
            f"Meal: {meal_type}\nEnergy: {energy_level}/10\nPantry: {pantry_str}\n\n"
            f"Write exactly one concise, warm sentence suggesting what to cook for {meal_type} "
            "using what's available. Be specific about an ingredient or dish. No preamble."
        )
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=80,
            messages=[
                {"role": "system", "content": "You are Chef, a kitchen assistant. Give brief, helpful meal suggestions."},
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return ""


def generate_decision_narrative(result: Any) -> str:
    """Generate a 2-3 sentence narrative explaining the decision. Returns '' if API unavailable."""
    client = _get_client()
    if not client:
        return ""

    try:
        rec = getattr(result, "recommendation", "")
        reasoning = getattr(result, "reasoning", [])
        options = getattr(result, "options", [])

        options_summary = "; ".join(
            f"{o.mode}: score={o.score}, cost=₹{o.cost}, time={o.time_minutes}min"
            for o in options
        ) if options else ""

        reasoning_text = ", ".join(reasoning[:4]) if reasoning else "no specific factors"

        prompt = (
            f"The Chef decision engine recommends: {rec}.\n"
            f"Key reasons: {reasoning_text}.\n"
            f"Options compared: {options_summary}.\n\n"
            "Write 2-3 concise, warm sentences explaining this recommendation to the user. "
            "Focus on the top 1-2 reasons. Use ₹ for currency. Be direct and helpful."
        )

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=150,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are Chef, a kitchen decision assistant. "
                        "Explain food decisions concisely and honestly. "
                        "Prefer reducing food waste when relevant."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        return ""
