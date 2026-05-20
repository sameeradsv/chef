"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type CookVsOrderResult, type DecisionOption, type UserState } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const defaultState: UserState = {
  energy_level: 5,
  time_available_minutes: 30,
  budget_today: 300,
  health_priority: 5,
  craving: "",
  willingness_to_cook: 5,
  stress_level: 5,
};

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>
      {children}
    </span>
  );
}

const MODE_META: Record<string, { label: string; sub: string; icon: string }> = {
  cook:     { label: "Cook",      sub: "at home",    icon: "◉" },
  order:    { label: "Order",     sub: "delivery",   icon: "◎" },
  eat_out:  { label: "Eat out",   sub: "restaurant", icon: "◈" },
};

function ScoreCard({
  option,
  winner,
  selected,
  onSelect,
}: {
  option: DecisionOption;
  winner: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = MODE_META[option.mode] ?? { label: option.mode, sub: "", icon: "◉" };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left transition-all duration-200"
      style={{
        border: winner
          ? "1px solid rgb(var(--kitchen-accent) / 0.45)"
          : selected
          ? "1px solid var(--kitchen-line2)"
          : "1px solid var(--kitchen-line)",
        borderRadius: "var(--radius-card)",
        background: winner
          ? "rgb(var(--kitchen-accent) / 0.06)"
          : "rgb(var(--kitchen-card))",
        boxShadow: winner ? "0 0 24px rgb(var(--kitchen-accent) / 0.12)" : "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Swatch */}
          <div
            className="flex-shrink-0 flex items-center justify-center text-sm"
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-card)",
              background: winner
                ? "rgb(var(--kitchen-accent) / 0.15)"
                : "rgb(var(--kitchen-surface))",
              color: winner ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
            }}
          >
            {meta.icon}
          </div>
          <div>
            <MonoLabel className={winner ? "text-kitchen-accent" : "text-kitchen-muted"}>
              {meta.label} · {meta.sub}
            </MonoLabel>
            <p
              className="font-display font-normal mt-0.5 leading-tight"
              style={{ fontSize: 17 }}
            >
              {option.label}
            </p>
          </div>
        </div>

        {/* Score / Win badge */}
        <div className="flex-shrink-0 text-right">
          {winner ? (
            <div
              className="px-2 py-1 text-[10px] font-mono font-medium"
              style={{
                background: "rgb(var(--kitchen-accent))",
                color: "rgb(26 18 10)",
                borderRadius: 999,
                letterSpacing: "0.1em",
              }}
            >
              WIN · {Math.round(option.score)}
            </div>
          ) : (
            <span
              className="font-display text-kitchen-muted"
              style={{ fontSize: 20 }}
            >
              {Math.round(option.score)}
            </span>
          )}
        </div>
      </div>

      {/* Expanded breakdown */}
      {selected && (
        <div
          className="px-4 pb-4 pt-1 space-y-1.5 animate-fade-in"
          style={{ borderTop: "1px solid var(--kitchen-line)" }}
        >
          <div className="pt-2 space-y-1.5">
            {(
              [
                { label: "Cost",   value: formatCurrency(option.cost),    dim: false, positive: true },
                { label: "Time",   value: `${option.time_minutes} min`,   dim: false, positive: true },
                { label: "Effort", value: option.effort_label,            dim: false, positive: true },
                ...Object.entries(option.factors).map(([k, v]) => ({
                  label: k.replace(/_/g, " "),
                  value: `${v > 0 ? "+" : ""}${v}`,
                  dim: true,
                  positive: v >= 0,
                })),
              ] as { label: string; value: string; dim: boolean; positive: boolean }[]
            ).map(({ label, value, dim, positive }) => (
              <div key={label} className="flex justify-between items-center">
                <MonoLabel className="text-kitchen-muted capitalize">{label}</MonoLabel>
                <span
                  className="text-xs font-mono"
                  style={{
                    color: dim
                      ? positive
                        ? "rgb(var(--kitchen-success))"
                        : "rgb(var(--kitchen-warn))"
                      : winner
                      ? "rgb(var(--kitchen-accent))"
                      : "rgb(var(--kitchen-ink2))",
                  }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
          {option.mode === "cook" && (
            <Link
              href="/recipe"
              className="block text-center text-xs font-mono text-kitchen-accent mt-3 py-2.5"
              style={{
                border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
                borderRadius: "var(--radius-btn)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              Browse recipes →
            </Link>
          )}
        </div>
      )}
    </button>
  );
}

function ContextDrawer({
  state,
  onChange,
  onApply,
  loading,
}: {
  state: UserState;
  onChange: (k: keyof UserState, v: number | string) => void;
  onApply: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  const sliders: { key: keyof UserState; label: string; min: number; max: number; step?: number; suffix?: string }[] = [
    { key: "energy_level",          label: "Energy",             min: 1,  max: 10 },
    { key: "willingness_to_cook",   label: "Willing to cook",    min: 1,  max: 10 },
    { key: "time_available_minutes",label: "Time available",     min: 10, max: 120, step: 5, suffix: "min" },
    { key: "budget_today",          label: "Budget",             min: 50, max: 800, step: 10, suffix: "₹" },
  ];

  return (
    <div
      className="overflow-hidden transition-all"
      style={{
        border: "1px solid var(--kitchen-line2)",
        borderRadius: "var(--radius-card)",
        background: "rgb(var(--kitchen-card))",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <MonoLabel className="text-kitchen-muted">YOUR CONTEXT</MonoLabel>
        <span className="text-kitchen-muted text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 animate-fade-in" style={{ borderTop: "1px solid var(--kitchen-line)" }}>
          {sliders.map(({ key, label, min, max, step = 1, suffix }) => (
            <div key={key}>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">{label.toUpperCase()}</MonoLabel>
                <MonoLabel className="text-kitchen-accent">
                  {state[key]}{suffix ?? ""}
                </MonoLabel>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={Number(state[key])}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="w-full accent-kitchen-accent"
                style={{ height: 2 }}
              />
            </div>
          ))}
          <div>
            <MonoLabel className="text-kitchen-muted block mb-1.5">CRAVING</MonoLabel>
            <input
              value={state.craving}
              onChange={(e) => onChange("craving", e.target.value)}
              placeholder="e.g. spicy, Indian…"
              className="w-full text-sm px-3 py-2 bg-kitchen-surface text-kitchen-text placeholder:text-kitchen-muted outline-none focus:ring-1 ring-kitchen-accent/50"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            />
          </div>
          <button
            type="button"
            onClick={() => { onApply(); setOpen(false); }}
            disabled={loading}
            className="w-full py-2.5 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            {loading ? "Updating…" : "Update comparison"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function DecisionPage() {
  const [result, setResult] = useState<CookVsOrderResult | null>(null);
  const [state, setState] = useState<UserState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  async function runDecision(updatedState?: UserState) {
    setLoading(true);
    try {
      if (updatedState) await api.setUserState(updatedState);
      const data = await api.cookVsOrder();
      setResult(data);
      setSelected(data.recommendation);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runDecision().then(() => setInitialized(true));
  }, []);

  if (!initialized && loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="loading-shimmer h-8 w-48 rounded-card" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="loading-shimmer h-24 rounded-card" />
        ))}
      </div>
    );
  }

  const winner = result?.recommendation ?? null;

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div>
        <div className="flex items-baseline justify-between">
          <h1
            className="font-display font-normal"
            style={{ fontSize: 28, letterSpacing: "-0.025em" }}
          >
            What&apos;s the{" "}
            <em className="not-italic text-kitchen-accent">move</em>?
          </h1>
          {result && (
            <MonoLabel className="text-kitchen-muted">
              {new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date())}
            </MonoLabel>
          )}
        </div>
        {result?.reasoning?.[0] && (
          <p className="text-sm text-kitchen-muted mt-1">{result.reasoning[0]}</p>
        )}
      </div>

      {/* Score cards */}
      {result && (
        <div className="space-y-2.5">
          {result.options.map((opt) => (
            <ScoreCard
              key={opt.mode}
              option={opt}
              winner={opt.mode === winner}
              selected={selected === opt.mode}
              onSelect={() => setSelected(opt.mode === selected ? null : opt.mode)}
            />
          ))}
        </div>
      )}

      {/* Context / sliders */}
      <ContextDrawer
        state={state}
        onChange={(k, v) => setState((s) => ({ ...s, [k]: v }))}
        onApply={() => runDecision(state)}
        loading={loading}
      />

      {/* Reasoning */}
      {result && result.reasoning.length > 1 && (
        <div
          className="p-4 space-y-2"
          style={{
            border: "1px solid var(--kitchen-line)",
            borderRadius: "var(--radius-card)",
            background: "rgb(var(--kitchen-surface))",
          }}
        >
          <MonoLabel className="text-kitchen-muted">WHY</MonoLabel>
          <ul className="space-y-1.5 mt-2">
            {result.reasoning.slice(1).map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-kitchen-text/90">
                <span className="text-kitchen-accent flex-shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Log CTA */}
      {result && (
        <div className="flex gap-2 pt-1">
          <Link
            href="/history"
            className="flex-1 py-3 text-sm font-medium text-center transition-opacity hover:opacity-90"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            Log this decision
          </Link>
          <button
            type="button"
            className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
            style={{
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "var(--radius-btn)",
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
