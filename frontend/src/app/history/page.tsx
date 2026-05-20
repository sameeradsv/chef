"use client";

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { api, HistoryEntry } from "@/lib/api";

const modeLabel: Record<string, string> = {
  cook: "Cooked at home",
  order: "Ordered delivery",
  eat_out: "Ate out",
};

const modeBadge: Record<string, string> = {
  cook: "bg-kitchen-success/15 text-kitchen-success",
  order: "bg-kitchen-accent/15 text-kitchen-accent",
  eat_out: "bg-kitchen-warn/15 text-kitchen-warn",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StarRating({ value, onChange }: { value?: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={`text-sm transition-colors ${
            value && n <= value ? "text-kitchen-accent" : "text-kitchen-border"
          } ${onChange ? "hover:text-kitchen-accent" : "cursor-default"}`}
          aria-label={`${n} star`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Log new decision form
  const [showLog, setShowLog] = useState(false);
  const [logDecision, setLogDecision] = useState<"cook" | "order" | "eat_out">("cook");
  const [logRecipe, setLogRecipe] = useState("");
  const [logCuisine, setLogCuisine] = useState("");
  const [logSatisfaction, setLogSatisfaction] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getHistory(50)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleLog(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const entry = await api.logHistory({
        decision: logDecision,
        recipe_name: logRecipe.trim() || undefined,
        cuisine: logCuisine.trim() || undefined,
        satisfaction: logSatisfaction,
      });
      setEntries((prev) => [entry, ...prev]);
      setShowLog(false);
      setLogRecipe("");
      setLogCuisine("");
      setLogSatisfaction(undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to log decision");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateSatisfaction(id: string, satisfaction: number) {
    // History entries don't have a PATCH endpoint, so we re-log as a workaround
    // Just update local state optimistically
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, satisfaction } : e))
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-kitchen-text tracking-tight">History</h1>
            <p className="text-kitchen-muted text-sm mt-1">Your food decision log</p>
          </div>
          <button
            onClick={() => setShowLog((v) => !v)}
            className="bg-kitchen-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + Log decision
          </button>
        </div>

        {/* Log form */}
        {showLog && (
          <form onSubmit={handleLog} className="bg-kitchen-surface border border-kitchen-border rounded-2xl p-5 space-y-4">
            <p className="text-sm font-medium text-kitchen-text">What did you decide?</p>
            <div className="flex gap-2">
              {(["cook", "order", "eat_out"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setLogDecision(m)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-all ${
                    logDecision === m
                      ? "border-kitchen-accent bg-kitchen-accent/10 text-kitchen-accent font-medium"
                      : "border-kitchen-border text-kitchen-muted hover:text-kitchen-text"
                  }`}
                >
                  {modeLabel[m]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-kitchen-muted mb-1">Recipe / meal (optional)</label>
                <input
                  value={logRecipe}
                  onChange={(e) => setLogRecipe(e.target.value)}
                  placeholder="e.g. Dal Tadka"
                  className="w-full bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-kitchen-muted mb-1">Cuisine (optional)</label>
                <input
                  value={logCuisine}
                  onChange={(e) => setLogCuisine(e.target.value)}
                  placeholder="e.g. Indian"
                  className="w-full bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-kitchen-muted mb-1">Satisfaction</label>
              <StarRating value={logSatisfaction} onChange={setLogSatisfaction} />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-kitchen-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowLog(false)}
                className="px-4 py-2 text-sm text-kitchen-muted hover:text-kitchen-text transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p className="text-sm text-kitchen-danger bg-kitchen-danger/10 border border-kitchen-danger/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-kitchen-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-kitchen-muted text-sm py-12">
            No decisions logged yet. Use the Decide page and your history will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="bg-kitchen-surface border border-kitchen-border rounded-xl px-4 py-3 flex items-start gap-4"
              >
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap mt-0.5 ${modeBadge[entry.decision] ?? "bg-kitchen-card text-kitchen-muted"}`}
                >
                  {modeLabel[entry.decision] ?? entry.decision}
                </span>
                <div className="flex-1 min-w-0">
                  {entry.recipe_name && (
                    <p className="text-sm text-kitchen-text font-medium truncate">{entry.recipe_name}</p>
                  )}
                  <p className="text-xs text-kitchen-muted">
                    {entry.cuisine ? `${entry.cuisine} · ` : ""}
                    {formatDate(entry.timestamp)}
                  </p>
                </div>
                <StarRating
                  value={entry.satisfaction ?? undefined}
                  onChange={(n) => updateSatisfaction(entry.id, n)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
}
