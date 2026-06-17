"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { api, type CookVsOrderResult, type DecisionOption, type UserState } from "@/lib/api";
import { gatherCombinedEnergy } from "@/lib/cross-app-energy";
import { TZ } from "@/lib/tz";
import { formatCurrency } from "@/lib/utils";
import {
  sheetFooterPadding,
  sheetOverlayStyle,
  sheetOverlayTallClass,
  sheetPanelStyle,
  sheetPanelTallClass,
} from "@/lib/mobile-layout";
import dynamic from "next/dynamic";

const DecisionScoreWaterfall = dynamic(
  () => import("@/components/DecisionScoreWaterfall"),
  { ssr: false, loading: () => null }
);

const defaultState: UserState = {
  energy_level: 5,
  time_available_minutes: 30,
  budget_today: 300,
  health_priority: 5,
  craving: "",
  willingness_to_cook: 5,
  stress_level: 5,
};

function willingnessBand(value: number): "low" | "mid" | "high" {
  if (value <= 3) return "low";
  if (value >= 8) return "high";
  return "mid";
}

function restaurantFromOption(opt: DecisionOption): string {
  if (opt.mode === "order" && opt.label.startsWith("Order from ")) return opt.label.slice("Order from ".length);
  if (opt.mode === "eat_out" && opt.label.startsWith("Eat at ")) return opt.label.slice("Eat at ".length);
  return opt.label;
}

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
  orderCost,
}: {
  option: DecisionOption;
  winner: boolean;
  selected: boolean;
  onSelect: () => void;
  orderCost?: number;
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
            <div className="mt-3 space-y-2">
              {orderCost != null && orderCost > 0 && option.cost > 0 && (
                <div className="flex justify-between items-center">
                  <MonoLabel className="text-kitchen-muted">Cost vs. order</MonoLabel>
                  <span className="text-xs font-mono" style={{ color: "rgb(var(--kitchen-accent))" }}>
                    {Math.round((1 - option.cost / orderCost) * 100)}% cheaper
                  </span>
                </div>
              )}
              {(option.details?.missing_ingredients as unknown as string[] | undefined)?.length ? (
                <div
                  className="px-3 py-2 text-[11px] font-mono"
                  style={{ background: "rgb(var(--kitchen-warn) / 0.08)", border: "1px solid rgb(var(--kitchen-warn) / 0.2)", borderRadius: "var(--radius-btn)" }}
                >
                  <span style={{ color: "rgb(var(--kitchen-warn))" }}>Need to order: </span>
                  <span className="text-kitchen-muted">{(option.details.missing_ingredients as unknown as string[]).join(", ")}</span>
                </div>
              ) : null}
              <Link
                href="/recipe"
                className="block text-center text-xs font-mono text-kitchen-accent py-2.5"
                style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.3)", borderRadius: "var(--radius-btn)" }}
                onClick={(e) => e.stopPropagation()}
              >
                Browse recipes →
              </Link>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

function ContextSheet({
  state,
  onChange,
  onApply,
  onReset,
  loading,
  people,
  onPeopleChange,
  defaultPeople,
  onClose,
}: {
  state: UserState;
  onChange: (k: keyof UserState, v: number | string) => void;
  onApply: (people: number) => void;
  onReset: () => void;
  loading: boolean;
  people: number;
  onPeopleChange: (n: number) => void;
  defaultPeople: number;
  onClose: () => void;
}) {
  const sliders: { key: keyof UserState; label: string; min: number; max: number; step?: number; suffix?: string }[] = [
    { key: "energy_level",           label: "Energy (override)",         min: 1,  max: 10 },
    { key: "willingness_to_cook",    label: "Up for cooking (override)", min: 1,  max: 10 },
    { key: "health_priority",        label: "Health priority",           min: 1,  max: 10 },
    { key: "stress_level",           label: "Stress level",              min: 1,  max: 10 },
    { key: "time_available_minutes", label: "Time available",            min: 10, max: 120, step: 5, suffix: "min" },
    { key: "budget_today",           label: "Budget",                    min: 50, max: 800, step: 10, suffix: "₹" },
  ];

  return (
    <div
      className={sheetOverlayTallClass}
      style={sheetOverlayStyle}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`${sheetPanelTallClass} md:max-h-[80dvh]`}
        style={sheetPanelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 pt-5 pb-3">
          <MonoLabel className="text-kitchen-muted">SESSION OVERRIDES</MonoLabel>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-3 space-y-5">
          <p className="text-[11px] text-kitchen-muted">
            Overrides today&apos;s comparison only. Energy preset matches Canopy&apos;s combined total; cooking mood from Settings.
          </p>
          {sliders.map(({ key, label, min, max, step = 1, suffix }) => (
            <div key={key}>
              <div className="flex justify-between mb-1.5">
                <MonoLabel className="text-kitchen-muted">{label.toUpperCase()}</MonoLabel>
                <MonoLabel className="text-kitchen-accent">{state[key]}{suffix ?? ""}</MonoLabel>
              </div>
              <input
                type="range" min={min} max={max} step={step}
                value={Number(state[key])}
                onChange={(e) => onChange(key, Number(e.target.value))}
                className="w-full accent-kitchen-accent" style={{ height: 2 }}
              />
            </div>
          ))}

          <div>
            <MonoLabel className="text-kitchen-muted block mb-1.5">CRAVING / MOOD</MonoLabel>
            <input
              value={state.craving}
              onChange={(e) => onChange("craving", e.target.value)}
              placeholder="e.g. spicy, something light, comfort food…"
              className="w-full text-sm px-3 py-2 bg-kitchen-surface text-kitchen-text placeholder:text-kitchen-muted outline-none focus:ring-1 ring-kitchen-accent/50"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            />
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <MonoLabel className="text-kitchen-muted">COOKING FOR</MonoLabel>
              <div className="flex items-center gap-2">
                <MonoLabel className="text-kitchen-accent">{people} {people === 1 ? "person" : "people"}</MonoLabel>
                {people !== defaultPeople && (
                  <button
                    type="button"
                    onClick={() => onPeopleChange(defaultPeople)}
                    className="text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors"
                    title={`Reset to saved default (${defaultPeople})`}
                  >↺</button>
                )}
              </div>
            </div>
            <input
              type="range" min={1} max={10} value={people}
              onChange={(e) => onPeopleChange(Number(e.target.value))}
              className="w-full accent-kitchen-accent" style={{ height: 2 }}
            />
          </div>
        </div>

        <div
          className="shrink-0 px-5 pt-3 space-y-2"
          style={{ borderTop: "1px solid var(--kitchen-line)", paddingBottom: sheetFooterPadding, background: "rgb(var(--kitchen-bg))" }}
        >
          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="w-full py-2 text-xs font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors disabled:opacity-50"
          >
            Reset to combined preset
          </button>
          <button
            type="button"
            onClick={() => { onApply(people); onClose(); }}
            disabled={loading}
            className="w-full py-3 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            {loading ? "Updating…" : "Update comparison"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
function DecisionPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const recipeId = searchParams.get("recipe") ?? undefined;
  const [result, setResult] = useState<CookVsOrderResult | null>(null);
  const [state, setState] = useState<UserState>(defaultState);
  const [baselineState, setBaselineState] = useState<UserState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"loading" | "waking" | "ready">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [energySources, setEnergySources] = useState<string[]>([]);
  const [peopleCount, setPeopleCount] = useState(2);
  const [defaultPeople, setDefaultPeople] = useState(2);
  const [showContext, setShowContext] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [consuming, setConsuming] = useState(false);
  const [logging, setLogging] = useState(false);
  const [logMessage, setLogMessage] = useState<string | null>(null);
  const [consumeResult, setConsumeResult] = useState<{ consumed: string[]; depleted: string[]; not_found: string[] } | null>(null);
  const [predict, setPredict] = useState<{
    likely_decision: string;
    confidence: number;
    message: string;
    savings_hint?: string | null;
  } | null>(null);
  const [costInsights, setCostInsights] = useState<string[]>([]);

  async function runDecision(sessionState?: UserState, people?: number) {
    setLoading(true);
    setStatus("loading");
    try {
      const activeState = sessionState ?? state;
      const data = await api.cookVsOrder(people ?? peopleCount, recipeId, activeState);
      setResult(data);
      setSelected(data.recommendation);
      setStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("load")) {
        setStatus("waking");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogDecision() {
    if (!result || !selected) return;
    setLogging(true);
    setLogMessage(null);
    try {
      const opt = result.options.find((o) => o.mode === selected);
      const payload: Parameters<typeof api.logHistory>[0] = {
        decision: selected,
        cost: opt?.cost,
      };
      if (selected === "cook") {
        payload.recipe_name = result.recommended_recipe?.name ?? opt?.label;
      } else if (opt) {
        payload.restaurant_name = restaurantFromOption(opt);
        payload.cuisine = result.recommended_restaurant?.cuisine;
        payload.delivery_available = selected === "order";
      }
      await api.logHistory(payload);
      setLogMessage("Logged to history");
      setTimeout(() => router.push("/history"), 600);
    } catch {
      setLogMessage("Could not log — try again");
    } finally {
      setLogging(false);
    }
  }

  // On mount: settings defaults + synced energy preset, then run comparison
  useEffect(() => {
    async function init() {
      let saved: UserState = defaultState;
      try {
        const s = await api.getUserState();
        saved = { ...defaultState, ...s };
      } catch { /* use defaults */ }

      const combinedEnergy = await gatherCombinedEnergy();
      const preset: UserState = {
        ...saved,
        energy_level: combinedEnergy.energy_level ?? saved.energy_level,
      };
      setBaselineState(preset);
      setState(preset);
      if (combinedEnergy.fromCombined) setEnergySources(combinedEnergy.sources);

      let people = 2;
      try {
        const prefs = await api.getPreferences();
        people = prefs.people_count ?? 2;
        setDefaultPeople(people);
        setPeopleCount(people);
      } catch { /* use default */ }

      try {
        const pred = await api.predictMeal();
        if (pred.message) setPredict(pred);
      } catch { /* optional — does not block decide */ }

      try {
        const ci = await api.costInsights();
        setCostInsights(ci.insights);
      } catch { /* optional */ }

      await runDecision(preset, people);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual retry (waking state or explicit retry button)
  useEffect(() => {
    if (attempt === 0) return;
    runDecision();
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-retry every 12s while waking
  useEffect(() => {
    if (status !== "waking") return;
    const t = setTimeout(() => setAttempt((n) => n + 1), 12000);
    return () => clearTimeout(t);
  }, [status, attempt]);

  if (status === "loading" && !result) {
    return (
      <div className="space-y-4 pt-2">
        <div className="loading-shimmer h-8 w-48 rounded-card" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="loading-shimmer h-24 rounded-card" />
        ))}
      </div>
    );
  }

  if (status === "waking") {
    return (
      <div className="pt-2">
        <div
          className="p-5 space-y-3 text-center"
          style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-accent) / 0.05)" }}
        >
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "rgb(var(--kitchen-accent))", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <p className="text-sm text-kitchen-text font-medium">Server is waking up…</p>
          <p className="text-xs text-kitchen-muted">Retrying automatically every 12 seconds.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="text-xs text-kitchen-accent font-mono hover:opacity-70 transition-opacity">
            RETRY NOW
          </button>
        </div>
      </div>
    );
  }

  const winner = result?.recommendation ?? null;

  return (
    <div className="space-y-4 pt-2">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1
          className="font-display font-normal"
          style={{ fontSize: 28, letterSpacing: "-0.025em" }}
        >
          What&apos;s the{" "}
          <em className="not-italic text-kitchen-accent">move</em>?
        </h1>
        {result && (
          <MonoLabel className="text-kitchen-muted flex-shrink-0">
            {new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date())}
          </MonoLabel>
        )}
      </div>

      {/* Context meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono truncate"
            style={{
              border: `1px solid ${state.energy_level <= 4 ? "rgb(var(--kitchen-warn) / 0.4)" : "var(--kitchen-line)"}`,
              borderRadius: "var(--radius-btn)",
              background: state.energy_level <= 4 ? "rgb(var(--kitchen-warn) / 0.07)" : "rgb(var(--kitchen-surface))",
              color: state.energy_level <= 4 ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-ink3))",
            }}
            title={
              state.energy_level !== baselineState.energy_level
                ? `Session override (combined preset ${baselineState.energy_level}/10)`
                : energySources.length > 0
                ? `Combined from ${energySources.join(" + ")} · ${state.energy_level}/10`
                : `Energy ${state.energy_level}/10`
            }
          >
            <span style={{ color: state.energy_level <= 4 ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-accent))" }}>◎</span>
            Energy {state.energy_level}/10
            {energySources.length > 0 && ` · ${energySources.join(" + ")}`}
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono truncate"
            style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))", color: "rgb(var(--kitchen-ink3))" }}
            title={
              state.willingness_to_cook !== baselineState.willingness_to_cook
                ? `Session override (default ${baselineState.willingness_to_cook}/10)`
                : `Default from Settings · ${state.willingness_to_cook}/10`
            }
          >
            Cook mood {willingnessBand(state.willingness_to_cook) === "low" ? "low" : willingnessBand(state.willingness_to_cook) === "high" ? "high" : "mid"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowContext(true)}
          className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="1.5"/><path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.4 2.4l1.1 1.1M8.5 8.5l1.1 1.1M9.6 2.4l-1.1 1.1M3.5 8.5l-1.1 1.1"/>
          </svg>
          Override
        </button>
      </div>
      {result && (
        <div className="space-y-2.5">
          {result.options.map((opt) => (
            <ScoreCard
              key={opt.mode}
              option={opt}
              winner={opt.mode === winner}
              selected={selected === opt.mode}
              onSelect={() => setSelected(opt.mode === selected ? null : opt.mode)}
              orderCost={opt.mode === "cook" ? result.options.find(o => o.mode === "order")?.cost : undefined}
            />
          ))}
        </div>
      )}

      {/* Auto-consume ingredients strip — shown when Cook is selected and recipe is known */}
      {result && selected === "cook" && result.recommended_recipe && !consumeResult && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.25)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-accent) / 0.05)" }}
        >
          <div className="min-w-0 flex-1">
            <MonoLabel className="text-kitchen-accent block">COOKING {result.recommended_recipe.name.toUpperCase()}</MonoLabel>
            <p className="text-xs text-kitchen-muted mt-0.5">
              {result.recommended_recipe.ingredients.filter(i => i.in_pantry).length} of {result.recommended_recipe.ingredients.length} ingredients in pantry
            </p>
          </div>
          <button
            type="button"
            disabled={consuming}
            onClick={async () => {
              setConsuming(true);
              try {
                const recipeId = result.recommended_recipe!.id;
                let overrides: Array<{ normalized_name: string; quantity: number }> = [];
                try {
                  const stored = localStorage.getItem(`recipe-qty-overrides-${recipeId}`);
                  if (stored) overrides = Object.entries(JSON.parse(stored)).map(([normalized_name, quantity]) => ({ normalized_name, quantity: quantity as number }));
                } catch { /* ignore */ }
                const r = await api.consumeRecipe(recipeId, overrides);
                setConsumeResult(r);
              } finally {
                setConsuming(false);
              }
            }}
            className="flex-shrink-0 ml-3 px-3 py-1.5 text-xs font-mono transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)", letterSpacing: "0.06em" }}
          >
            {consuming ? "Updating…" : "DONE COOKING →"}
          </button>
        </div>
      )}

      {/* Consume result feedback */}
      {consumeResult && (
        <div
          className="px-4 py-3 space-y-1"
          style={{ border: "1px solid rgb(var(--kitchen-success) / 0.3)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-success) / 0.06)" }}
        >
          <MonoLabel className="text-kitchen-muted block mb-1">PANTRY UPDATED</MonoLabel>
          {consumeResult.consumed.length > 0 && (
            <p className="text-xs text-kitchen-text">Reduced: {consumeResult.consumed.join(", ")}</p>
          )}
          {consumeResult.depleted.length > 0 && (
            <p className="text-xs" style={{ color: "rgb(var(--kitchen-warn))" }}>Used up: {consumeResult.depleted.join(", ")}</p>
          )}
          {consumeResult.not_found.length > 0 && (
            <p className="text-xs text-kitchen-muted">Not in pantry: {consumeResult.not_found.join(", ")}</p>
          )}
          <button
            type="button"
            onClick={() => setConsumeResult(null)}
            className="text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors mt-1"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Rationale — collapsible, below options */}
      {result && (predict || costInsights.length > 0 || result.narrative || result.reasoning.length > 0) && (
        <div>
          <button
            type="button"
            onClick={() => setShowRationale((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono tracking-[0.1em] text-kitchen-muted hover:text-kitchen-accent transition-colors"
            style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
          >
            <span>RATIONALE</span>
            <span>{showRationale ? "▲" : "▼"}</span>
          </button>
          {showRationale && (
            <div className="mt-2 space-y-3">
              {result.reasoning[0] && (
                <p className="text-sm text-kitchen-muted px-1">{result.reasoning[0]}</p>
              )}
              {result.narrative && (
                <p
                  className="text-sm text-kitchen-text leading-relaxed px-1"
                  style={{ borderLeft: "2px solid rgb(var(--kitchen-accent) / 0.4)", paddingLeft: 12 }}
                >
                  {result.narrative}
                </p>
              )}
              {result.reasoning.length > 1 && (
                <div
                  className="p-4 space-y-2"
                  style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-surface))" }}
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
              {predict && (
                <div
                  className="p-3 rounded-card font-mono text-xs"
                  style={{ border: "1px solid var(--kitchen-line)", background: "rgb(var(--kitchen-surface))", letterSpacing: "0.03em" }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-kitchen-muted">HISTORY SUGGESTS</span>
                    <span
                      className="px-2 py-0.5 rounded-btn uppercase"
                      style={{ background: "rgb(var(--kitchen-accent) / 0.12)", color: "rgb(var(--kitchen-accent))", fontSize: 10 }}
                    >
                      {predict.likely_decision.replace("_", " ")}
                    </span>
                    <span className="text-kitchen-muted">{Math.round(predict.confidence * 100)}% confidence</span>
                  </div>
                  <p className="text-kitchen-text m-0 leading-relaxed">{predict.message}</p>
                  {predict.savings_hint && (
                    <p className="text-kitchen-accent mt-2 mb-0 opacity-90">{predict.savings_hint}</p>
                  )}
                </div>
              )}
              {costInsights.length > 0 && (
                <div
                  className="p-3 rounded-card font-mono text-xs"
                  style={{ border: "1px solid var(--kitchen-line)", background: "rgb(var(--kitchen-surface))", letterSpacing: "0.03em" }}
                >
                  <div className="text-kitchen-muted mb-2">SPEND TRENDS (30D)</div>
                  <ul className="m-0 p-0 list-none space-y-1">
                    {costInsights.map((line) => (
                      <li key={line} className="text-kitchen-text leading-relaxed">{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Score breakdown chart toggle */}
      {result && (
        <div>
          <button
            type="button"
            onClick={() => setShowChart((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono tracking-[0.1em] text-kitchen-muted hover:text-kitchen-accent transition-colors"
            style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
          >
            <span>SCORE BREAKDOWN</span>
            <span>{showChart ? "▲" : "▼"}</span>
          </button>
          {showChart && (
            <div className="mt-2">
              <DecisionScoreWaterfall options={result.options} />
            </div>
          )}
        </div>
      )}

      {/* Context sheet (modal) */}
      {showContext && (
        <ContextSheet
          state={state}
          onChange={(k, v) => setState((s) => ({ ...s, [k]: v }))}
          onApply={(people) => { setPeopleCount(people); runDecision(state, people); }}
          onReset={() => {
            setState(baselineState);
            runDecision(baselineState, peopleCount);
          }}
          loading={loading}
          people={peopleCount}
          onPeopleChange={setPeopleCount}
          defaultPeople={defaultPeople}
          onClose={() => setShowContext(false)}
        />
      )}

      {/* People count badge */}
      {result && (
        <div
          className="flex items-center gap-2 px-3 py-2 text-[11px] font-mono text-kitchen-muted"
          style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
        >
          <span style={{ color: "rgb(var(--kitchen-accent))" }}>◎</span>
          Costs shown for {peopleCount} {peopleCount === 1 ? "person" : "people"} · adjust in context above
        </div>
      )}

      {/* Log CTA */}
      {result && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={logging || !selected}
              onClick={handleLogDecision}
              className="flex-1 py-3 text-sm font-medium text-center transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "rgb(var(--kitchen-accent))",
                color: "rgb(26 18 10)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              {logging ? "Logging…" : "Log this decision"}
            </button>
            <button
              type="button"
              className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
              style={{
                border: "1px solid var(--kitchen-line2)",
                borderRadius: "var(--radius-btn)",
              }}
              onClick={() => runDecision()}
            >
              Refresh
            </button>
          </div>
          {logMessage && (
            <p className="text-xs text-center font-mono" style={{ color: logMessage.startsWith("Could") ? "rgb(var(--kitchen-danger))" : "rgb(var(--kitchen-success))" }}>
              {logMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DecisionPage() {
  return (
    <Suspense>
      <DecisionPageInner />
    </Suspense>
  );
}
