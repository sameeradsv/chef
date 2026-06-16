"use client";

import { useEffect, useState } from "react";
import { api, FoodSuggestion, NutrientStat, NutritionSummary } from "@/lib/api";

// Module-level TTL cache keyed by `days` — avoids re-fetching on navigation back.
const _nutritionCache = new Map<number, { data: NutritionSummary; ts: number }>();
const NUTRITION_CACHE_MS = 5 * 60_000; // 5 minutes

// ── Sub-components ──────────────────────────────────────────────────────────

function Ring({
  label,
  value,
  unit,
  pct,
  status,
}: {
  label: string;
  value: number;
  unit: string;
  pct: number;
  status: "low" | "ok" | "high";
}) {
  const r = 28;
  const sw = 5;
  const c = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1.08) * c;
  const color =
    status === "ok"
      ? "rgb(var(--kitchen-accent))"
      : status === "high"
      ? "rgb(var(--kitchen-danger))"
      : "rgb(var(--kitchen-warn))";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[72px] h-[72px]">
        <svg width={72} height={72} viewBox="0 0 72 72">
          <circle
            cx={36} cy={36} r={r}
            fill="none"
            strokeWidth={sw}
            style={{ stroke: "rgba(128,128,128,0.14)" }}
          />
          <circle
            cx={36} cy={36} r={r}
            fill="none"
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
            transform="rotate(-90 36 36)"
            style={{ stroke: color, transition: "stroke-dasharray 0.55s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[12px] font-mono font-semibold" style={{ color: "rgb(var(--kitchen-ink))" }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <p className="text-[9.5px] font-mono tracking-wide text-kitchen-muted text-center uppercase leading-none">
        {label}
      </p>
      <p className="text-[10px] font-mono" style={{ color }}>
        {value} {unit}
      </p>
    </div>
  );
}

function NutrientBar({
  label,
  value,
  unit,
  pct,
  status,
}: {
  label: string;
  value: number;
  unit: string;
  pct: number;
  status: "low" | "ok" | "high";
}) {
  const bar = Math.min(pct, 100);
  const color =
    status === "ok"
      ? "rgb(var(--kitchen-accent))"
      : status === "high"
      ? "rgb(var(--kitchen-danger))"
      : "rgb(var(--kitchen-warn))";

  return (
    <div className="flex items-center gap-3">
      <p className="text-[11px] font-mono text-kitchen-muted w-[88px] flex-shrink-0 truncate">{label}</p>
      <div className="flex-1 h-[5px] rounded-full" style={{ backgroundColor: "rgba(128,128,128,0.13)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${bar}%`,
            backgroundColor: color,
            transition: "width 0.5s ease",
          }}
        />
      </div>
      <p className="text-[10px] font-mono text-kitchen-muted w-[64px] text-right flex-shrink-0">
        {value}{unit} · {Math.round(pct)}%
      </p>
    </div>
  );
}

function SuggCard({ sugg }: { sugg: FoodSuggestion }) {
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1.5"
      style={{ backgroundColor: "rgb(var(--kitchen-surface))" }}
    >
      <p className="text-[13px] font-medium" style={{ color: "rgb(var(--kitchen-ink))" }}>
        {sugg.food}
      </p>
      <p className="text-[11px] text-kitchen-muted leading-snug">{sugg.reason}</p>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {sugg.nutrients.slice(0, 3).map((n) => (
          <span
            key={n}
            className="text-[9px] font-mono px-1.5 py-[2px] rounded-full"
            style={{
              backgroundColor: "rgba(var(--kitchen-accent), 0.12)",
              color: "rgb(var(--kitchen-accent))",
            }}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Constants ───────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [7, 14, 30];

const MEAL_TABS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch"     },
  { key: "snack",     label: "Snack"     },
  { key: "dinner",    label: "Dinner"    },
];

const PRIMARY_KEYS  = ["calories", "protein_g", "carbs_g", "fat_g"];
const SECONDARY_KEYS = ["fiber_g", "sugar_g", "sodium_mg"];
const VITAMIN_KEYS  = ["vitamin_a", "vitamin_c", "vitamin_d", "iron", "calcium", "b12"];

// ── Page ────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const [data, setData]       = useState<NutritionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [days, setDays]       = useState(7);
  const [mealTab, setMealTab] = useState("breakfast");

  useEffect(() => {
    const cached = _nutritionCache.get(days);
    if (cached && Date.now() - cached.ts < NUTRITION_CACHE_MS) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getNutritionSummary(days)
      .then((d) => { _nutritionCache.set(days, { data: d, ts: Date.now() }); setData(d); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const byKey = (key: string): NutrientStat | undefined =>
    data?.nutrients.find((n) => n.key === key);

  const noData = !loading && data && data.meals_logged === 0;

  return (
    <div className="space-y-5 pb-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "rgb(var(--kitchen-ink))" }}>
            Nutrition Health
          </h1>
          <p className="text-[11px] font-mono text-kitchen-muted mt-0.5">
            Estimated from your logged meals
          </p>
        </div>
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ backgroundColor: "rgb(var(--kitchen-surface))" }}
        >
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors"
              style={
                days === d
                  ? { backgroundColor: "rgba(var(--kitchen-accent), 0.13)", color: "rgb(var(--kitchen-accent))" }
                  : { color: "rgb(var(--kitchen-muted))" }
              }
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "rgb(var(--kitchen-accent)) transparent transparent transparent" }} />
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div
          className="rounded-xl p-4 text-sm text-kitchen-muted"
          style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
        >
          Could not load nutrition data — {error}
        </div>
      )}

      {/* ── Empty state ── */}
      {noData && (
        <div
          className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
        >
          <span style={{ fontSize: 36 }}>🥗</span>
          <p className="font-semibold" style={{ color: "rgb(var(--kitchen-ink))" }}>
            No meals logged yet
          </p>
          <p className="text-sm text-kitchen-muted max-w-xs">
            Log your meals on the History page or make a Cook / Order decision — your nutrition profile builds automatically from the recipe names.
          </p>
        </div>
      )}

      {/* ── Main content ── */}
      {data && data.meals_logged > 0 && (
        <>
          {/* Summary strip */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-0"
            style={{ backgroundColor: "rgb(var(--kitchen-surface))" }}
          >
            {[
              { val: data.meals_logged, sub: "MEALS" },
              { val: data.days_analyzed, sub: "DAYS" },
              { val: data.nutrients.filter((n) => n.status === "low").length,  sub: "LOW",  accent: "warn" },
              { val: data.nutrients.filter((n) => n.status === "high").length, sub: "OVER", accent: "danger" },
            ].map((item, i, arr) => (
              <div key={item.sub} className="flex-1 text-center">
                <p
                  className="text-base font-semibold font-mono"
                  style={{
                    color:
                      item.accent === "warn"
                        ? "rgb(var(--kitchen-warn))"
                        : item.accent === "danger"
                        ? "rgb(var(--kitchen-danger))"
                        : "rgb(var(--kitchen-ink))",
                  }}
                >
                  {item.val}
                </p>
                <p className="text-[9px] font-mono text-kitchen-muted">{item.sub}</p>
                {i < arr.length - 1 && (
                  <div
                    className="absolute h-6 w-px self-center"
                    style={{ backgroundColor: "var(--kitchen-line)" }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* ── Primary macros (rings) ── */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
          >
            <p className="text-[10px] font-mono text-kitchen-muted tracking-[0.18em] mb-4">
              PRIMARY MACROS · DAILY AVG
            </p>
            <div className="grid grid-cols-4 gap-1">
              {PRIMARY_KEYS.map((key) => {
                const n = byKey(key);
                if (!n) return null;
                return (
                  <Ring
                    key={key}
                    label={n.label}
                    value={Math.round(n.daily_avg)}
                    unit={n.unit}
                    pct={n.pct_rda}
                    status={n.status}
                  />
                );
              })}
            </div>
            <p className="text-[9px] font-mono text-kitchen-muted mt-3 text-center">
              Rings show % of daily reference amount
            </p>
          </div>

          {/* ── Fiber / Sugar / Sodium ── */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
          >
            <p className="text-[10px] font-mono text-kitchen-muted tracking-[0.18em]">
              FIBER · SUGAR · SODIUM
            </p>
            {SECONDARY_KEYS.map((key) => {
              const n = byKey(key);
              if (!n) return null;
              return (
                <NutrientBar
                  key={key}
                  label={n.label}
                  value={Math.round(n.daily_avg)}
                  unit={n.unit}
                  pct={n.pct_rda}
                  status={n.status}
                />
              );
            })}
            <p className="text-[9px] font-mono text-kitchen-muted pt-0.5">
              Sugar &amp; sodium: bar shows % of daily limit — less is better for those.
            </p>
          </div>

          {/* ── Vitamins & Minerals ── */}
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
          >
            <p className="text-[10px] font-mono text-kitchen-muted tracking-[0.18em]">
              VITAMINS &amp; MINERALS
            </p>
            {VITAMIN_KEYS.map((key) => {
              const n = byKey(key);
              if (!n) return null;
              return (
                <NutrientBar
                  key={key}
                  label={n.label}
                  value={Math.round(n.daily_avg)}
                  unit={n.unit}
                  pct={n.pct_rda}
                  status={n.status}
                />
              );
            })}
          </div>

          {/* ── Gaps ── */}
          {data.gaps.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
            >
              <p className="text-[10px] font-mono text-kitchen-muted tracking-[0.18em] mb-3">
                GAPS DETECTED
              </p>
              <ul className="space-y-2">
                {data.gaps.map((gap, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px]" style={{ color: "rgb(var(--kitchen-ink))" }}>
                    <span className="mt-0.5 flex-shrink-0" style={{ color: "rgb(var(--kitchen-warn))" }}>·</span>
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Suggestions by meal time ── */}
          {data.suggestions.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
            >
              <p className="text-[10px] font-mono text-kitchen-muted tracking-[0.18em] mb-3">
                WHAT TO EAT NEXT
              </p>

              {/* Meal tabs */}
              <div className="flex gap-1 mb-4">
                {MEAL_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setMealTab(key)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-colors"
                    style={
                      mealTab === key
                        ? {
                            backgroundColor: "rgba(var(--kitchen-accent), 0.12)",
                            color: "rgb(var(--kitchen-accent))",
                          }
                        : {
                            backgroundColor: "rgb(var(--kitchen-surface))",
                            color: "rgb(var(--kitchen-muted))",
                          }
                    }
                  >
                    {label.slice(0, 5).toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Suggestions list */}
              {(() => {
                const forMeal = data.meal_suggestions[mealTab] ?? [];
                const display = forMeal.length > 0 ? forMeal : data.suggestions.slice(0, 4);
                return display.length > 0 ? (
                  <div className="space-y-2">
                    {display.map((s, i) => (
                      <SuggCard key={i} sugg={s} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-kitchen-muted text-center py-4">
                    No specific suggestions for this time of day.
                  </p>
                );
              })()}
            </div>
          )}

          {/* All-good state */}
          {data.gaps.length === 0 && data.nutrients.length > 0 && (
            <div
              className="rounded-2xl p-6 text-center"
              style={{ backgroundColor: "rgb(var(--kitchen-card))" }}
            >
              <p className="text-2xl mb-2">✓</p>
              <p className="font-semibold" style={{ color: "rgb(var(--kitchen-ink))" }}>
                All macros and micronutrients within range
              </p>
              <p className="text-sm text-kitchen-muted mt-1">
                Keep up the variety in your meals to maintain this balance.
              </p>
            </div>
          )}

          <p className="text-[9px] font-mono text-kitchen-muted text-center">
            Estimates based on meal names · Not medical advice · Values are daily averages
          </p>
        </>
      )}
    </div>
  );
}
