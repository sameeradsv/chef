"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type BarcodeResult, type DiscardedIngredient, type Ingredient, type WasteSummaryItem } from "@/lib/api";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { formatCurrency } from "@/lib/utils";

const CATEGORIES = ["All", "Produce", "Protein", "Dairy", "Grains", "Pantry"];

function expiryText(days?: number | null) {
  if (days == null) return null;
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return `${days}d`;
  if (days <= 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

function expiryStyle(days?: number | null): React.CSSProperties {
  if (days == null || days > 5) return { color: "rgb(var(--kitchen-ink3))", background: "rgb(var(--kitchen-surface))" };
  if (days <= 2) return { color: "rgb(var(--kitchen-accent))", background: "rgb(var(--kitchen-accent) / 0.12)" };
  return { color: "rgb(var(--kitchen-warn))", background: "rgb(var(--kitchen-warn) / 0.12)" };
}

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

const emptyForm = {
  name: "",
  quantity: 0,
  unit: "grams",
  expiry_date: "",
  storage_type: "fridge",
  opened: false,
  cost: 0,
};

const DISCARD_REASONS = [
  { id: "expired",  label: "Expired",       desc: "Past the use-by date" },
  { id: "spoiled",  label: "Spoiled early",  desc: "Went bad before expiry" },
  { id: "other",    label: "Other",          desc: "Surplus, not needed, etc." },
];

/* ─── Discard sheet ─────────────────────────────────────────────────────── */
function DiscardSheet({
  ingredient,
  onConfirm,
  onClose,
}: {
  ingredient: Ingredient;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const isExpired = (ingredient.days_until_expiry ?? 1) < 0;
  const [reason, setReason] = useState(isExpired ? "expired" : "spoiled");

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          padding: "20px 22px calc(24px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg">Discard item</h2>
            <p className="text-sm text-kitchen-muted mt-0.5">{ingredient.name} · {ingredient.quantity} {ingredient.unit}</p>
          </div>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <MonoLabel className="text-kitchen-muted block mb-2">REASON</MonoLabel>
        <div className="space-y-2 mb-5">
          {DISCARD_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
              style={{
                border: reason === r.id
                  ? "1px solid rgb(var(--kitchen-accent) / 0.5)"
                  : "1px solid var(--kitchen-line2)",
                borderRadius: "var(--radius-btn)",
                background: reason === r.id ? "rgb(var(--kitchen-accent) / 0.07)" : "rgb(var(--kitchen-card))",
              }}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center"
                style={{
                  borderColor: reason === r.id ? "rgb(var(--kitchen-accent))" : "var(--kitchen-line2)",
                }}
              >
                {reason === r.id && (
                  <div className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--kitchen-accent))" }} />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-kitchen-text">{r.label}</p>
                <p className="text-[11px] text-kitchen-muted">{r.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--kitchen-warn))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            Confirm discard
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
            style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Add / Edit sheet ─────────────────────────────────────────────────── */
function IngredientSheet({
  editing,
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  editing: Ingredient | null;
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const inputCls = "w-full bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted";
  const inputStyle: React.CSSProperties = { border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" };

  return (
    <div
      className="fixed inset-0 z-60 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-auto animate-fade-in"
        style={{
          background: "rgb(var(--kitchen-bg))",
          borderRadius: "var(--radius-card) var(--radius-card) 0 0",
          padding: "20px 22px calc(20px + env(safe-area-inset-bottom, 0px))",
          borderTop: "1px solid var(--kitchen-line2)",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg">{editing ? "Edit ingredient" : "Add ingredient"}</h2>
          <button type="button" onClick={onClose} className="text-kitchen-muted hover:text-kitchen-text w-8 h-8 flex items-center justify-center text-lg">×</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <MonoLabel className="text-kitchen-muted block mb-1.5">NAME</MonoLabel>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Cremini mushrooms" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">QUANTITY</MonoLabel>
              <input type="number" required value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">UNIT</MonoLabel>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="grams" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">EXPIRY DATE</MonoLabel>
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">STORAGE</MonoLabel>
              <select value={form.storage_type} onChange={(e) => setForm({ ...form, storage_type: e.target.value })} className={inputCls} style={inputStyle}>
                <option value="fridge">Fridge</option>
                <option value="pantry">Pantry</option>
                <option value="freezer">Freezer</option>
              </select>
            </div>
            <div>
              <MonoLabel className="text-kitchen-muted block mb-1.5">COST (₹)</MonoLabel>
              <input type="number" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={inputCls} style={inputStyle} />
            </div>
            <div className="flex items-center gap-2.5 col-span-2">
              <input type="checkbox" id="opened" checked={form.opened} onChange={(e) => setForm({ ...form, opened: e.target.checked })} className="accent-kitchen-accent w-4 h-4" />
              <label htmlFor="opened" className="text-sm text-kitchen-muted">Opened / in use</label>
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              className="flex-1 py-3 text-sm font-medium transition-opacity hover:opacity-90"
              style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
            >
              {editing ? "Save changes" : "Add to pantry"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-sm text-kitchen-muted transition-colors hover:text-kitchen-text"
              style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Waste log view ────────────────────────────────────────────────────── */
function WasteLogView() {
  const [discarded, setDiscarded] = useState<DiscardedIngredient[]>([]);
  const [summary, setSummary] = useState<WasteSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getDiscardedIngredients(), api.getWasteSummary()])
      .then(([d, s]) => { setDiscarded(d); setSummary(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 pt-2">
        {[1, 2, 3].map((i) => <div key={i} className="loading-shimmer h-14 rounded-card" />)}
      </div>
    );
  }

  if (discarded.length === 0) {
    return (
      <div className="py-16 text-center" style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}>
        <p className="text-kitchen-muted text-sm">No discards logged yet.</p>
        <p className="text-kitchen-muted text-xs mt-1">Use "Discard" on pantry items to track food waste.</p>
      </div>
    );
  }

  const totalWasted = discarded.reduce((s, d) => s + (d.cost || 0), 0);

  return (
    <div className="space-y-5 pb-4">
      {/* Summary cards */}
      {summary.length > 0 && (
        <div>
          <MonoLabel className="text-kitchen-muted block mb-2">MOST WASTED</MonoLabel>
          <div className="space-y-2">
            {summary.slice(0, 5).map((s) => (
              <div
                key={s.normalized_name}
                className="flex items-center justify-between px-4 py-3"
                style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
              >
                <div>
                  <p className="text-sm text-kitchen-text capitalize">{s.ingredient_name}</p>
                  <MonoLabel className="text-kitchen-muted mt-0.5">{s.discard_count}× discarded</MonoLabel>
                </div>
                {s.total_cost > 0 && (
                  <span className="text-sm font-mono text-kitchen-warn">{formatCurrency(s.total_cost)} lost</span>
                )}
              </div>
            ))}
          </div>
          {totalWasted > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2.5 mt-2"
              style={{ background: "rgb(var(--kitchen-warn) / 0.07)", border: "1px solid rgb(var(--kitchen-warn) / 0.2)", borderRadius: "var(--radius-btn)" }}
            >
              <MonoLabel style={{ color: "rgb(var(--kitchen-warn))" }}>TOTAL FOOD COST WASTED</MonoLabel>
              <span className="text-sm font-mono font-medium" style={{ color: "rgb(var(--kitchen-warn))" }}>{formatCurrency(totalWasted)}</span>
            </div>
          )}
        </div>
      )}

      {/* Chronological log */}
      <div>
        <MonoLabel className="text-kitchen-muted block mb-2">RECENT DISCARDS</MonoLabel>
        <ul className="space-y-2">
          {discarded.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between px-4 py-3"
              style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-kitchen-text truncate capitalize">{d.ingredient_name}</p>
                <MonoLabel className="text-kitchen-muted mt-0.5">
                  {d.quantity} {d.unit} · {d.discard_reason}
                  {d.expiry_date ? ` · exp ${d.expiry_date.slice(0, 10)}` : ""}
                </MonoLabel>
              </div>
              <div className="ml-3 text-right flex-shrink-0">
                {d.cost > 0 && (
                  <p className="text-xs font-mono text-kitchen-muted">{formatCurrency(d.cost)}</p>
                )}
                <MonoLabel className="text-kitchen-muted">
                  {new Date(d.discarded_at).toLocaleDateString("en", { day: "numeric", month: "short" })}
                </MonoLabel>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */
export default function InventoryPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showScanner, setShowScanner] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [discarding, setDiscarding] = useState<Ingredient | null>(null);
  const [view, setView] = useState<"pantry" | "waste">("pantry");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storageMap: Record<string, string> = {
        Produce: "fridge", Protein: "fridge", Dairy: "fridge",
        Grains: "pantry", Pantry: "pantry",
      };
      const data = await api.getIngredients(
        filter !== "All" && storageMap[filter] ? { storage: storageMap[filter] } : undefined
      );
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, quantity: Number(form.quantity), cost: Number(form.cost), expiry_date: form.expiry_date || undefined };
    if (editing) { await api.updateIngredient(editing.id, payload); } else { await api.createIngredient(payload); }
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  function startEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({ name: ing.name, quantity: ing.quantity, unit: ing.unit, expiry_date: ing.expiry_date?.slice(0, 10) || "", storage_type: ing.storage_type, opened: ing.opened, cost: ing.cost });
    setShowForm(true);
  }

  async function handleBarcode(barcode: string) {
    setShowScanner(false);
    setScanLoading(true);
    try {
      const result: BarcodeResult = await api.lookupBarcode(barcode);
      setEditing(null);
      setForm({
        name: result.ingredient_name || result.product_name,
        quantity: result.quantity,
        unit: result.unit,
        expiry_date: "",
        storage_type: "pantry",
        opened: false,
        cost: 0,
      });
      setShowForm(true);
    } catch {
      setEditing(null);
      setForm(emptyForm);
      setShowForm(true);
    } finally {
      setScanLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this ingredient?")) return;
    await api.deleteIngredient(id);
    load();
  }

  async function handleDiscard(reason: string) {
    if (!discarding) return;
    await api.discardIngredient(discarding.id, reason);
    setDiscarding(null);
    load();
  }

  const fresh    = items.filter((i) => (i.days_until_expiry ?? 99) > 5).length;
  const expiring = items.filter((i) => (i.days_until_expiry ?? 99) <= 5 && (i.days_until_expiry ?? -1) >= 0).length;
  const expired  = items.filter((i) => (i.days_until_expiry ?? 0) < 0).length;

  return (
    <div className="space-y-5 pt-2">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <MonoLabel className="text-kitchen-muted">PANTRY</MonoLabel>
          <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
            <span className="text-kitchen-accent">{items.length}</span> items
          </h1>
        </div>
        {/* Pantry / Waste toggle */}
        <div
          className="flex p-0.5"
          style={{ border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
        >
          {(["pantry", "waste"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="px-3 py-1.5 text-[11px] font-mono transition-all"
              style={{
                borderRadius: "calc(var(--radius-btn) - 2px)",
                background: view === v ? "rgb(var(--kitchen-ink))" : "transparent",
                color: view === v ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                letterSpacing: "0.08em",
              }}
            >
              {v === "pantry" ? "PANTRY" : "WASTE LOG"}
            </button>
          ))}
        </div>
      </div>

      {view === "waste" ? (
        <WasteLogView />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "FRESH",   value: fresh,    highlight: false },
              { label: "EXPIRING",value: expiring, highlight: expiring > 0 },
              { label: "EXPIRED", value: expired,  highlight: expired > 0, danger: true },
            ].map(({ label, value, highlight, danger }) => (
              <div
                key={label}
                className="p-3 text-center"
                style={{
                  border: danger && value > 0
                    ? "1px solid rgb(var(--kitchen-danger) / 0.3)"
                    : highlight
                    ? "1px solid rgb(var(--kitchen-accent) / 0.3)"
                    : "1px solid var(--kitchen-line)",
                  background: danger && value > 0
                    ? "rgb(var(--kitchen-danger) / 0.06)"
                    : highlight
                    ? "rgb(var(--kitchen-accent) / 0.06)"
                    : "rgb(var(--kitchen-card))",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <p className={`text-xl font-display font-normal ${danger && value > 0 ? "text-kitchen-danger" : highlight ? "text-kitchen-accent" : "text-kitchen-text"}`}>{value}</p>
                <MonoLabel className="text-kitchen-muted mt-0.5 block">{label}</MonoLabel>
              </div>
            ))}
          </div>

          {/* Expired banner */}
          {expired > 0 && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgb(var(--kitchen-danger) / 0.07)", border: "1px solid rgb(var(--kitchen-danger) / 0.25)", borderRadius: "var(--radius-card)" }}
            >
              <div className="flex items-center gap-2">
                <span className="animate-pulse-dot text-kitchen-danger text-xs">●</span>
                <p className="text-sm text-kitchen-text">{expired} item{expired > 1 ? "s" : ""} past expiry — discard to log waste</p>
              </div>
            </div>
          )}

          {/* Category filter chips */}
          <div
            className="flex gap-2 overflow-x-auto pb-1 -mx-[22px] px-[22px]"
            style={{ borderBottom: "1px solid var(--kitchen-line)" }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-mono tracking-wide transition-colors"
                style={{
                  borderRadius: 999,
                  border: filter === cat ? "1px solid transparent" : "1px solid var(--kitchen-line2)",
                  background: filter === cat ? "rgb(var(--kitchen-ink))" : "transparent",
                  color: filter === cat ? "rgb(var(--kitchen-accent))" : "rgb(var(--kitchen-ink3))",
                  letterSpacing: "0.08em",
                }}
              >
                {cat.toUpperCase()}
              </button>
            ))}
            <div className="flex-shrink-0 w-[22px]" />
          </div>

          {/* Ingredient list */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="loading-shimmer h-16 rounded-card" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div
              className="py-12 text-center"
              style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}
            >
              <p className="text-kitchen-muted text-sm">No ingredients yet.</p>
              <button
                type="button"
                onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
                className="mt-3 text-kitchen-accent text-sm font-mono tracking-wide"
              >
                + ADD FIRST ITEM
              </button>
            </div>
          ) : (
            <ul className="space-y-2 pb-4">
              {items.map((ing) => {
                const label = expiryText(ing.days_until_expiry);
                const style = expiryStyle(ing.days_until_expiry);
                const isExpired = (ing.days_until_expiry ?? 1) < 0;
                return (
                  <li key={ing.id}>
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-card)", background: "rgb(var(--kitchen-card))" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-kitchen-text truncate">{ing.name}</p>
                        <MonoLabel className="text-kitchen-muted mt-0.5">
                          {ing.quantity} {ing.unit} · {ing.storage_type}{ing.opened ? " · opened" : ""}
                        </MonoLabel>
                      </div>
                      <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                        {label && (
                          <span
                            className="text-[10px] font-mono px-2 py-0.5"
                            style={{ borderRadius: 999, letterSpacing: "0.05em", ...style }}
                          >
                            {label}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setDiscarding(ing)}
                          className="text-xs font-mono transition-colors"
                          style={{ color: isExpired ? "rgb(var(--kitchen-warn))" : "rgb(var(--kitchen-ink3))" }}
                        >
                          {isExpired ? "Discard" : "Discard"}
                        </button>
                        <button type="button" onClick={() => startEdit(ing)} className="text-xs text-kitchen-muted hover:text-kitchen-accent transition-colors">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDelete(ing.id)} className="text-xs text-kitchen-muted hover:text-kitchen-danger transition-colors">
                          ×
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* FABs — only in pantry view */}
      {view === "pantry" && (
        <div
          className="fixed right-5 flex flex-col items-center gap-3 z-40"
          style={{ bottom: "calc(72px + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={scanLoading}
            className="w-12 h-12 flex items-center justify-center transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            style={{
              background: "rgb(var(--kitchen-surface))",
              border: "1px solid var(--kitchen-line2)",
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            }}
            aria-label="Scan barcode"
          >
            {scanLoading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--kitchen-accent))" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--kitchen-ink2))" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
                <line x1="8" y1="8" x2="8" y2="16"/>
                <line x1="11" y1="8" x2="11" y2="16"/>
                <line x1="14" y1="8" x2="14" y2="16"/>
                <line x1="17" y1="8" x2="17" y2="16"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}
            className="w-14 h-14 flex items-center justify-center text-2xl font-light transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "rgb(var(--kitchen-accent))",
              color: "rgb(26 18 10)",
              borderRadius: "50%",
              boxShadow: "0 8px 24px rgb(var(--kitchen-accent) / 0.35), 0 0 0 1px rgb(var(--kitchen-accent) / 0.4)",
            }}
            aria-label="Add ingredient"
          >
            +
          </button>
        </div>
      )}

      {/* Barcode scanner overlay */}
      {showScanner && (
        <BarcodeScanner
          onDetected={handleBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Add/Edit sheet */}
      {showForm && (
        <IngredientSheet
          editing={editing}
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Discard sheet */}
      {discarding && (
        <DiscardSheet
          ingredient={discarding}
          onConfirm={handleDiscard}
          onClose={() => setDiscarding(null)}
        />
      )}
    </div>
  );
}
