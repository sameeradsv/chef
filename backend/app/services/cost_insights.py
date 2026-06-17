"""Logged-meal cost trends — deterministic from history (not platform pricing)."""
from __future__ import annotations

from collections import defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import CookingHistoryModel
from app.tz_utils import current_meal_day, meal_day_bounds


def cost_insights(db: Session, user_id: str) -> dict:
    today = current_meal_day()
    cur_start, _ = meal_day_bounds((today - timedelta(days=30)).isoformat())
    _, cur_end = meal_day_bounds(today.isoformat())
    prev_start, _ = meal_day_bounds((today - timedelta(days=60)).isoformat())
    prev_end = cur_start

    cur_rows = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == user_id,
            CookingHistoryModel.timestamp >= cur_start,
            CookingHistoryModel.timestamp < cur_end,
            CookingHistoryModel.cost.isnot(None),
        )
        .all()
    )
    prev_rows = (
        db.query(CookingHistoryModel)
        .filter(
            CookingHistoryModel.user_id == user_id,
            CookingHistoryModel.timestamp >= prev_start,
            CookingHistoryModel.timestamp < prev_end,
            CookingHistoryModel.cost.isnot(None),
        )
        .all()
    )

    insights: list[str] = []
    by_decision: dict[str, list[float]] = defaultdict(list)
    for r in cur_rows:
        if r.cost is not None:
            by_decision[r.decision].append(float(r.cost))

    for decision, costs in by_decision.items():
        if not costs:
            continue
        avg = sum(costs) / len(costs)
        prev_costs = [float(r.cost) for r in prev_rows if r.decision == decision and r.cost is not None]
        if prev_costs:
            prev_avg = sum(prev_costs) / len(prev_costs)
            if prev_avg > 0:
                pct = int(round((avg - prev_avg) / prev_avg * 100))
                if abs(pct) >= 5:
                    direction = "up" if pct > 0 else "down"
                    insights.append(
                        f"Avg {decision.replace('_', ' ')} spend ₹{avg:.0f} ({abs(pct)}% {direction} vs prior 30d)"
                    )
                    continue
        insights.append(f"Avg {decision.replace('_', ' ')} spend ₹{avg:.0f} (last 30d, {len(costs)} meals)")

    weekday_avg: dict[int, list[float]] = defaultdict(list)
    for r in cur_rows:
        if r.cost is not None and r.decision in ("order", "eat_out"):
            wd = r.timestamp.weekday()
            weekday_avg[wd].append(float(r.cost))
    if weekday_avg:
        best = min(weekday_avg.items(), key=lambda kv: sum(kv[1]) / len(kv[1]))
        names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        insights.append(
            f"Cheapest order/eat-out day lately: {names[best[0]]} "
            f"(avg ₹{sum(best[1])/len(best[1]):.0f})"
        )

    if not insights:
        insights.append("Log meal costs on History to unlock spend trends.")

    return {"insights": insights[:5], "meal_count": len(cur_rows)}
