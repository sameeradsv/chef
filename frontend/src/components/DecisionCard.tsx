import Link from "next/link";
import type { DecisionOption } from "@/lib/api";
import { formatCurrency, modeLabel } from "@/lib/utils";

export function DecisionCard({
  option,
  recommended,
}: {
  option: DecisionOption;
  recommended?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: "var(--radius-card)",
        border: recommended
          ? "1px solid rgb(var(--kitchen-accent) / 0.4)"
          : "1px solid var(--kitchen-line)",
        background: recommended
          ? "rgb(var(--kitchen-accent) / 0.05)"
          : "rgb(var(--kitchen-card))",
        boxShadow: recommended ? "0 0 20px rgb(var(--kitchen-accent) / 0.1)" : "none",
        padding: "16px",
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-[10px] font-mono tracking-[0.12em] text-kitchen-muted uppercase mb-1">
            {modeLabel(option.mode)}
          </p>
          <h3 className="font-medium text-kitchen-text">{option.label}</h3>
        </div>
        {recommended && (
          <span
            className="text-[10px] font-mono px-2 py-0.5"
            style={{ borderRadius: 999, background: "rgb(var(--kitchen-accent) / 0.15)", color: "rgb(var(--kitchen-accent))", letterSpacing: "0.08em" }}
          >
            WIN
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm mb-3">
        <div>
          <p className="text-[10px] font-mono text-kitchen-muted uppercase mb-0.5">Cost</p>
          <p className="text-kitchen-accent font-medium">{formatCurrency(option.cost)}</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-kitchen-muted uppercase mb-0.5">Time</p>
          <p className="text-kitchen-text">{option.time_minutes} min</p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-kitchen-muted uppercase mb-0.5">Effort</p>
          <p className="text-kitchen-text">{option.effort_label}</p>
        </div>
      </div>
      <details className="text-xs text-kitchen-muted">
        <summary className="cursor-pointer hover:text-kitchen-text transition-colors font-mono tracking-wide">
          SCORE BREAKDOWN
        </summary>
        <ul className="mt-2 space-y-1">
          {Object.entries(option.factors).map(([k, v]) => (
            <li key={k} className="flex justify-between capitalize">
              <span>{k.replace(/_/g, " ")}</span>
              <span style={{ color: v >= 0 ? "rgb(var(--kitchen-success))" : "rgb(var(--kitchen-warn))" }}>
                {v > 0 ? "+" : ""}{v}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
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
    <div
      style={{
        borderRadius: "var(--radius-card)",
        border: "1px solid rgb(var(--kitchen-accent) / 0.4)",
        background: "rgb(var(--kitchen-accent) / 0.05)",
        boxShadow: "0 0 20px rgb(var(--kitchen-accent) / 0.1)",
        padding: "18px 20px",
      }}
    >
      <p className="text-[10px] font-mono tracking-[0.12em] text-kitchen-muted uppercase mb-1">
        Recommendation
      </p>
      <h2 className="font-display text-xl text-kitchen-accent mb-4" style={{ letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <ul className="space-y-2 mb-4">
        {reasoning.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm text-kitchen-text/90">
            <span className="text-kitchen-accent">·</span>
            {r}
          </li>
        ))}
      </ul>
      {recipeId && mode === "cook" && (
        <Link href={`/recipe/${recipeId}`} className="text-sm text-kitchen-accent hover:opacity-80 transition-opacity font-mono tracking-wide">
          VIEW RECIPE →
        </Link>
      )}
    </div>
  );
}
