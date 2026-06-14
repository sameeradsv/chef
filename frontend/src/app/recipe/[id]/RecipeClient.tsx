"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingCard } from "@/components/Card";
import { api, type Recipe } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

function IngredientCheckbox({ checked }: { checked: boolean }) {
  return (
    <div
      className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
      style={{
        borderRadius: 4,
        border: checked
          ? "1.5px solid rgb(var(--kitchen-accent))"
          : "1.5px solid rgb(var(--kitchen-accent) / 0.45)",
        background: checked ? "rgb(var(--kitchen-accent))" : "transparent",
      }}
    >
      {checked && (
        <svg viewBox="0 0 10 8" width="10" height="8" fill="none" stroke="rgb(26 18 10)" strokeWidth="2" strokeLinecap="round">
          <polyline points="1 4 3.5 6.5 9 1" />
        </svg>
      )}
    </div>
  );
}

function MonoLabel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`} style={style}>{children}</span>;
}

function MeterCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="p-3 text-center"
      style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
    >
      <MonoLabel className="text-kitchen-muted block mb-1">{label}</MonoLabel>
      <p className="font-display text-lg font-normal text-kitchen-text leading-tight">{value}</p>
      {sub && <MonoLabel className="text-kitchen-muted mt-0.5 block">{sub}</MonoLabel>}
    </div>
  );
}

const OVERRIDES_KEY = (id: string) => `recipe-qty-overrides-${id}`;

function loadOverrides(id: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDES_KEY(id)) || "{}");
  } catch {
    return {};
  }
}

function saveOverrides(id: string, overrides: Record<string, number>) {
  localStorage.setItem(OVERRIDES_KEY(id), JSON.stringify(overrides));
}

export function RecipeClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const isTonightsPick = searchParams.get("pick") === "1";
  const [recipe, setRecipe]   = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ingredients" | "method">("ingredients");
  const [addingToList, setAddingToList] = useState(false);
  const [addedToList, setAddedToList]   = useState(false);
  const [cookingMode, setCookingMode]   = useState(false);
  const [activeStep, setActiveStep]     = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [stepTimers, setStepTimers]     = useState<Record<number, number | null>>({});
  const [timerIntervals, setTimerIntervals] = useState<Record<number, ReturnType<typeof setInterval>>>({});
  // Ingredient quantity overrides (persisted to localStorage)
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [editingIng, setEditingIng] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  // Consume state
  const [consuming, setConsuming] = useState(false);
  const [consumeResult, setConsumeResult] = useState<{ consumed: string[]; depleted: string[]; not_found: string[] } | null>(null);

  function startCooking() {
    setCookingMode(true);
    setActiveTab("method");
    setActiveStep(0);
    setCompletedSteps(new Set());
    setStepTimers({});
  }

  function advanceStep() {
    // Stop any running timer for current step
    if (timerIntervals[activeStep]) {
      clearInterval(timerIntervals[activeStep]);
      setTimerIntervals(prev => { const n = {...prev}; delete n[activeStep]; return n; });
    }
    setCompletedSteps((prev) => new Set([...prev, activeStep]));
    if (activeStep < recipe!.instructions.length - 1) {
      setActiveStep((s) => s + 1);
    } else {
      setCookingMode(false);
    }
  }

  function toggleTimer(stepIdx: number, durationSeconds: number) {
    if (timerIntervals[stepIdx]) {
      clearInterval(timerIntervals[stepIdx]);
      setTimerIntervals(prev => { const n = {...prev}; delete n[stepIdx]; return n; });
    } else {
      const remaining = stepTimers[stepIdx] ?? durationSeconds;
      setStepTimers(prev => ({ ...prev, [stepIdx]: remaining }));
      const interval = setInterval(() => {
        setStepTimers(prev => {
          const cur = (prev[stepIdx] ?? 1) - 1;
          if (cur <= 0) {
            clearInterval(interval);
            setTimerIntervals(p => { const n = {...p}; delete n[stepIdx]; return n; });
            return { ...prev, [stepIdx]: 0 };
          }
          return { ...prev, [stepIdx]: cur };
        });
      }, 1000);
      setTimerIntervals(prev => ({ ...prev, [stepIdx]: interval }));
    }
  }

  function extractMinutes(text: string): number | null {
    const m = text.match(/\b(\d+)\s*(?:–|-|to\s+\d+\s*)?(?:minutes?|mins?)\b/i);
    return m ? parseInt(m[1]) : null;
  }

  useEffect(() => {
    api.getRecipe(id)
      .then((r) => { setRecipe(r); setQtyOverrides(loadOverrides(r.id)); })
      .catch(() => setError("Could not load recipe."))
      .finally(() => setLoading(false));
  }, [id]);

  function startEdit(normalizedName: string, currentQty: number) {
    setEditingIng(normalizedName);
    setEditValue(String(qtyOverrides[normalizedName] ?? currentQty));
  }

  function commitEdit(normalizedName: string) {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed > 0) {
      const next = { ...qtyOverrides, [normalizedName]: parsed };
      setQtyOverrides(next);
      saveOverrides(id, next);
    }
    setEditingIng(null);
  }

  function resetOverride(normalizedName: string) {
    const next = { ...qtyOverrides };
    delete next[normalizedName];
    setQtyOverrides(next);
    saveOverrides(id, next);
  }

  async function handleConsume() {
    if (!recipe) return;
    setConsuming(true);
    setConsumeResult(null);
    try {
      const overrides = Object.entries(qtyOverrides).map(([normalized_name, quantity]) => ({ normalized_name, quantity }));
      const result = await api.consumeRecipe(recipe.id, overrides);
      setConsumeResult(result);
    } finally {
      setConsuming(false);
    }
  }

  if (loading) return <div className="space-y-4 pt-2"><LoadingCard /><LoadingCard /></div>;

  if (error || !recipe) {
    return (
      <div className="pt-2 space-y-3">
        <p className="text-kitchen-danger text-sm">{error || "Recipe not found"}</p>
        <Link href="/" className="text-sm text-kitchen-accent font-mono tracking-wide">← BACK</Link>
      </div>
    );
  }

  const totalTime = recipe.prep_time_minutes + recipe.cook_time_minutes;

  return (
    <div className="space-y-5 pt-2">
      {/* Back */}
      <Link href="/" className="text-xs font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors tracking-[0.1em]">
        ← BACK
      </Link>

      {/* Hero swatch */}
      <div
        className="relative overflow-hidden"
        style={{ borderRadius: "var(--radius-card)", height: 200 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, rgb(var(--kitchen-accent2) / 0.5) 0%, rgb(var(--kitchen-accent) / 0.25) 50%, rgb(var(--kitchen-surface)) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "repeating-linear-gradient(45deg, rgb(var(--kitchen-accent) / 0.03) 0 6px, transparent 6px 12px)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{ height: "60%", background: "linear-gradient(180deg, transparent, rgb(var(--kitchen-card)))" }}
        />
        <div className="absolute bottom-4 left-4 right-4">
          <MonoLabel className="text-kitchen-muted">{recipe.cuisine}</MonoLabel>
          <h1
            className="font-display font-normal mt-1 leading-tight"
            style={{ fontSize: 26, letterSpacing: "-0.02em" }}
          >
            {recipe.name}
          </h1>
        </div>
        {/* Tonight's pick chip — only when navigated from dashboard */}
        {isTonightsPick ? (
          <div
            className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono"
            style={{
              background: "rgb(var(--kitchen-bg) / 0.8)",
              backdropFilter: "blur(8px)",
              borderRadius: 999,
              color: "rgb(var(--kitchen-accent))",
              letterSpacing: "0.1em",
              border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
            }}
          >
            <span className="animate-pulse-dot">⌁</span> TONIGHT&apos;S PICK
          </div>
        ) : recipe.pantry_match_pct >= 80 ? (
          <div
            className="absolute top-3 right-3 px-2.5 py-1 text-[10px] font-mono"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: 999,
              letterSpacing: "0.1em",
            }}
          >
            {recipe.pantry_match_pct}% MATCH
          </div>
        ) : null}
      </div>

      {/* Meters row */}
      <div className="grid grid-cols-4 gap-2">
        <MeterCard label="ACTIVE"  value={`${recipe.prep_time_minutes}m`} />
        <MeterCard label="TOTAL"   value={`${totalTime}m`} />
        <MeterCard label="SKILL"   value={`${recipe.difficulty}/5`} />
        <MeterCard label="PANTRY"  value={`${recipe.pantry_match_pct}%`} />
      </div>

      {/* Expiring alert */}
      {recipe.uses_expiring.length > 0 && (
        <div
          className="flex items-start gap-2 px-4 py-3"
          style={{
            border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
            background: "rgb(var(--kitchen-accent) / 0.07)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <span className="text-kitchen-accent text-xs animate-pulse-dot mt-0.5">●</span>
          <p className="text-sm text-kitchen-text">
            Uses expiring: <span className="text-kitchen-accent">{recipe.uses_expiring.join(", ")}</span>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--kitchen-line)" }}>
        {(["ingredients", "method"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2.5 text-xs font-mono transition-colors"
            style={{
              letterSpacing: "0.1em",
              color: activeTab === tab ? "rgb(var(--kitchen-ink))" : "rgb(var(--kitchen-ink3))",
              borderBottom: activeTab === tab ? "1.5px solid rgb(var(--kitchen-accent))" : "1.5px solid transparent",
              marginBottom: -1,
            }}
          >
            {tab === "ingredients"
              ? `INGREDIENTS · ${recipe.ingredients.length}`
              : `METHOD · ${recipe.instructions.length} STEPS`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "ingredients" ? (
        <div className="space-y-4 animate-fade-in">
          {/* In your pantry */}
          {recipe.ingredients.filter(i => i.in_pantry).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <MonoLabel className="text-kitchen-muted">
                  IN YOUR PANTRY · {recipe.ingredients.filter(i => i.in_pantry).length}
                </MonoLabel>
                <MonoLabel className="text-kitchen-muted opacity-60">tap qty to adjust</MonoLabel>
              </div>
              <ul className="space-y-1.5">
                {recipe.ingredients.filter(i => i.in_pantry).map((ing) => {
                  const overrideQty = qtyOverrides[ing.normalized_name];
                  const displayQty = overrideQty ?? ing.quantity;
                  const isEditing = editingIng === ing.normalized_name;
                  return (
                    <li
                      key={ing.normalized_name}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
                    >
                      <IngredientCheckbox checked={true} />
                      <span className="flex-1 text-sm text-kitchen-text capitalize">
                        {ing.normalized_name.replace(/_/g, " ")}
                      </span>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(ing.normalized_name); if (e.key === "Escape") setEditingIng(null); }}
                            className="w-16 text-right text-xs font-mono bg-kitchen-surface text-kitchen-text px-2 py-1 outline-none focus:ring-1 ring-kitchen-accent/50"
                            style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.5)", borderRadius: "var(--radius-btn)" }}
                          />
                          <MonoLabel className="text-kitchen-muted">{ing.unit}</MonoLabel>
                          <button type="button" onClick={() => commitEdit(ing.normalized_name)} className="text-[10px] font-mono text-kitchen-accent hover:opacity-70">✓</button>
                          <button type="button" onClick={() => setEditingIng(null)} className="text-[10px] font-mono text-kitchen-muted hover:opacity-70">✕</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(ing.normalized_name, ing.quantity)}
                          className="flex items-center gap-1.5 group"
                          title="Tap to adjust quantity"
                        >
                          <MonoLabel
                            className="text-kitchen-muted group-hover:text-kitchen-accent transition-colors"
                            style={overrideQty != null ? { color: "rgb(var(--kitchen-accent))", textDecoration: "underline dotted" } : {}}
                          >
                            {displayQty} {ing.unit}
                          </MonoLabel>
                          {overrideQty != null && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); resetOverride(ing.normalized_name); }}
                              className="text-[9px] text-kitchen-muted hover:text-kitchen-warn transition-colors"
                              title="Reset to recipe default"
                            >↺</button>
                          )}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* To get */}
          {recipe.ingredients.filter(i => !i.in_pantry).length > 0 && (
            <div>
              <MonoLabel className="text-kitchen-accent block mb-2">
                TO GET · {recipe.ingredients.filter(i => !i.in_pantry).length}
              </MonoLabel>
              <ul className="space-y-1.5">
                {recipe.ingredients.filter(i => !i.in_pantry).map((ing) => (
                  <li
                    key={ing.normalized_name}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ border: "1px solid rgb(var(--kitchen-accent) / 0.2)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
                  >
                    <IngredientCheckbox checked={false} />
                    <span className="flex-1 text-sm text-kitchen-text capitalize">
                      {ing.normalized_name.replace(/_/g, " ")}
                    </span>
                    <MonoLabel style={{ color: "rgb(var(--kitchen-accent))" }}>{ing.quantity} {ing.unit}</MonoLabel>
                  </li>
                ))}
              </ul>

              {/* Add missing to shopping list */}
              <button
                type="button"
                disabled={addingToList || addedToList}
                onClick={async () => {
                  setAddingToList(true);
                  try {
                    await Promise.all(
                      recipe.ingredients.filter(i => !i.in_pantry).map(ing =>
                        api.addGrocery({ ingredient_name: ing.normalized_name.replace(/_/g, " "), quantity: ing.quantity, unit: ing.unit })
                      )
                    );
                    setAddedToList(true);
                  } catch { /* ignore */ }
                  finally { setAddingToList(false); }
                }}
                className="mt-2 w-full py-2.5 text-xs font-mono transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{
                  border: "1px solid rgb(var(--kitchen-accent) / 0.4)",
                  borderRadius: "var(--radius-btn)",
                  color: addedToList ? "rgb(var(--kitchen-success))" : "rgb(var(--kitchen-accent))",
                  background: "rgb(var(--kitchen-accent) / 0.05)",
                  letterSpacing: "0.06em",
                }}
              >
                {addedToList
                  ? `✓ Added to shopping list`
                  : addingToList
                  ? "Adding…"
                  : `+ Add ${recipe.ingredients.filter(i => !i.in_pantry).length} missing to shopping list`}
              </button>
            </div>
          )}

          {recipe.substitutions.length > 0 && (
            <div className="space-y-2">
              <MonoLabel className="text-kitchen-muted block">SUBSTITUTIONS</MonoLabel>
              {recipe.substitutions.map((s, i) => (
                <div
                  key={i}
                  className="px-4 py-3"
                  style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-kitchen-warn">{s.missing}</span>
                    <span className="text-kitchen-muted">→</span>
                    <span className="text-kitchen-success">{s.substitute}</span>
                  </div>
                  {s.note && <p className="text-xs text-kitchen-muted mt-1">{s.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ol className="space-y-2 animate-fade-in">
          {recipe.instructions.map((step, i) => {
            const isDone   = completedSteps.has(i);
            const isActive = cookingMode && i === activeStep;
            return (
              <li
                key={i}
                className="flex gap-3 px-4 py-3 transition-all"
                style={{
                  border: isActive
                    ? "1px solid rgb(var(--kitchen-accent) / 0.45)"
                    : "1px solid var(--kitchen-line)",
                  borderRadius: "var(--radius-card)",
                  background: isActive
                    ? "rgb(var(--kitchen-accent) / 0.05)"
                    : "rgb(var(--kitchen-card))",
                  opacity: isDone ? 0.45 : cookingMode && !isActive ? 0.6 : 1,
                  boxShadow: isActive ? "0 0 0 1px rgb(var(--kitchen-accent) / 0.12)" : "none",
                }}
              >
                <div
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-sm font-mono"
                  style={{
                    borderRadius: "50%",
                    background: isActive
                      ? "rgb(var(--kitchen-accent))"
                      : isDone
                      ? "rgb(var(--kitchen-success) / 0.18)"
                      : "rgb(var(--kitchen-accent) / 0.12)",
                    color: isActive
                      ? "rgb(26 18 10)"
                      : isDone
                      ? "rgb(var(--kitchen-success))"
                      : "rgb(var(--kitchen-accent))",
                  }}
                >
                  {isDone ? "✓" : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-kitchen-text leading-relaxed pt-0.5">{step}</p>
                  {isActive && (() => {
                    const mins = extractMinutes(step);
                    const secs = stepTimers[i];
                    const running = !!timerIntervals[i];
                    const displayTime = secs != null
                      ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
                      : null;
                    return (
                      <div className="mt-3 flex gap-2 flex-wrap">
                        {mins && (
                          <button
                            type="button"
                            onClick={() => toggleTimer(i, mins * 60)}
                            className="px-3 py-1.5 text-xs font-mono transition-opacity hover:opacity-80"
                            style={{
                              border: "1px solid rgb(var(--kitchen-accent) / 0.4)",
                              borderRadius: "var(--radius-btn)",
                              color: running ? "rgb(var(--kitchen-success))" : "rgb(var(--kitchen-accent))",
                              background: running ? "rgb(var(--kitchen-success) / 0.08)" : "rgb(var(--kitchen-accent) / 0.06)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {running && displayTime ? `⏱ ${displayTime}` : secs === 0 ? "✓ Done" : `Start timer · ${mins}m`}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={advanceStep}
                          className="px-4 py-1.5 text-xs font-mono font-medium transition-opacity hover:opacity-90"
                          style={{
                            background: "rgb(var(--kitchen-accent))",
                            color: "rgb(26 18 10)",
                            borderRadius: "var(--radius-btn)",
                          }}
                        >
                          {i < recipe.instructions.length - 1 ? "Next step →" : "Finished! ✓"}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Cook & consume result */}
      {consumeResult && (
        <div
          className="px-4 py-3 space-y-1 animate-fade-in"
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
          <button type="button" onClick={() => setConsumeResult(null)} className="text-[10px] font-mono text-kitchen-muted hover:text-kitchen-accent transition-colors mt-1">DISMISS</button>
        </div>
      )}

      {/* Bottom action */}
      <div className="flex gap-2 pb-4">
        {cookingMode ? (
          <>
            <div
              className="flex-1 px-4 py-3 text-xs font-mono text-center"
              style={{
                background: "rgb(var(--kitchen-accent) / 0.08)",
                border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
                borderRadius: "var(--radius-btn)",
                color: "rgb(var(--kitchen-accent))",
                letterSpacing: "0.08em",
              }}
            >
              STEP {activeStep + 1} OF {recipe.instructions.length}
            </div>
            <button
              type="button"
              onClick={() => setCookingMode(false)}
              className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            >
              Stop
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startCooking}
              className="flex-1 py-3 text-sm font-medium text-center transition-opacity hover:opacity-90"
              style={{
                background: "rgb(var(--kitchen-accent))",
                color: "rgb(26 18 10)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              Begin cooking → {recipe.prep_time_minutes}m active
            </button>
            <button
              type="button"
              disabled={consuming}
              onClick={handleConsume}
              className="px-4 py-3 text-xs font-mono transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                border: "1px solid rgb(var(--kitchen-accent) / 0.4)",
                borderRadius: "var(--radius-btn)",
                color: "rgb(var(--kitchen-accent))",
                background: "rgb(var(--kitchen-accent) / 0.06)",
                letterSpacing: "0.04em",
              }}
              title="Subtract these ingredients from your pantry"
            >
              {consuming ? "…" : "Consume"}
            </button>
            <Link
              href={`/decision?recipe=${recipe.id}`}
              className="px-4 py-3 text-sm text-kitchen-muted font-mono text-center transition-colors hover:text-kitchen-text"
              style={{
                border: "1px solid var(--kitchen-line2)",
                borderRadius: "var(--radius-btn)",
              }}
            >
              Compare
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
