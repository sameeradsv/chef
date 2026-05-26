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
