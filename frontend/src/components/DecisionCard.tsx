import Link from "next/link";
import type { DecisionOption } from "@/lib/api";
import { formatCurrency, modeLabel } from "@/lib/utils";
import { Card } from "./Card";

export function DecisionCard({
  option,
  recommended,
}: {
  option: DecisionOption;
  recommended?: boolean;
}) {
  return (
    <Card highlight={recommended}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-kitchen-muted mb-1">
            {modeLabel(option.mode)}
          </p>
          <h3 className="font-medium text-kitchen-text">{option.label}</h3>
        </div>
        {recommended && (
          <span className="text-xs px-2 py-1 rounded-full bg-kitchen-accent/20 text-kitchen-accent">
            Best fit
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm mb-4">
        <div>
          <p className="text-kitchen-muted text-xs">Cost</p>
          <p className="text-kitchen-accent font-medium">
            {formatCurrency(option.cost)}
          </p>
        </div>
        <div>
          <p className="text-kitchen-muted text-xs">Time</p>
          <p>{option.time_minutes} min</p>
        </div>
        <div>
          <p className="text-kitchen-muted text-xs">Effort</p>
          <p>{option.effort_label}</p>
        </div>
      </div>
      <details className="text-xs text-kitchen-muted">
        <summary className="cursor-pointer hover:text-kitchen-text transition-colors">
          Score breakdown
        </summary>
        <ul className="mt-2 space-y-1">
          {Object.entries(option.factors).map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="capitalize">{k.replace(/_/g, " ")}</span>
              <span className={v >= 0 ? "text-kitchen-success" : "text-kitchen-warn"}>
                {v > 0 ? "+" : ""}
                {v}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

export function MealRecommendation({
  title,
  reasoning,
  mode,
  recipeId,
}: {
  title: string;
  reasoning: string[];
  mode: string;
  recipeId?: string;
}) {
  return (
    <Card highlight>
      <p className="text-xs text-kitchen-muted uppercase tracking-wider mb-1">
        Recommendation
      </p>
      <h2 className="text-xl font-display text-kitchen-accent mb-4">{title}</h2>
      <ul className="space-y-2 mb-4">
        {reasoning.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm text-kitchen-text/90">
            <span className="text-kitchen-accent">•</span>
            {r}
          </li>
        ))}
      </ul>
      {recipeId && mode === "cook" && (
        <Link
          href={`/recipe/${recipeId}`}
          className="text-sm text-kitchen-accent hover:underline"
        >
          View recipe →
        </Link>
      )}
    </Card>
  );
}
