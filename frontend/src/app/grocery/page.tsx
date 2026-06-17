"use client";

import { useEffect, useState } from "react";
import { api, type GroceryItem } from "@/lib/api";

function MonoLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-mono tracking-[0.12em] uppercase ${className}`}>{children}</span>;
}

function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="flex-shrink-0 w-5 h-5 flex items-center justify-center transition-colors"
      style={{
        borderRadius: 4,
        border: checked
          ? "1.5px solid rgb(var(--kitchen-accent))"
          : "1.5px solid var(--kitchen-line2)",
        background: checked ? "rgb(var(--kitchen-accent) / 0.15)" : "transparent",
      }}
      aria-label={checked ? "Mark as not bought" : "Mark as bought"}
    >
      {checked && (
        <svg viewBox="0 0 12 10" width="10" height="8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-kitchen-accent">
          <polyline points="1 5 4.5 8.5 11 1" />
        </svg>
      )}
    </button>
  );
}

export default function GroceryPage() {
  const [items, setItems]           = useState<GroceryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [name, setName]             = useState("");
  const [qty, setQty]               = useState("");
  const [unit, setUnit]             = useState("");
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listGrocery(), api.grocerySuggestions()])
      .then(([list, sugg]) => { setItems(list); setSuggestions(sugg); })
      .catch(() => setError("Could not load grocery list."))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const item = await api.addGrocery({
        ingredient_name: name.trim(),
        quantity: qty ? parseFloat(qty) : undefined,
        unit: unit.trim() || undefined,
      });
      setItems((prev) => [item, ...prev]);
      setName(""); setQty(""); setUnit("");
    } catch (e: unknown) {
      setError("Failed to add item. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function toggleBought(item: GroceryItem) {
    try {
      const updated = await api.updateGrocery(item.id, { bought: !item.bought });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteGrocery(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ }
  }

  async function addSuggestion(s: string) {
    setAdding(true);
    try {
      const item = await api.addGrocery({ ingredient_name: s });
      setItems((prev) => [item, ...prev]);
      setSuggestions((prev) => prev.filter((x) => x !== s));
    } catch { /* ignore */ }
    finally { setAdding(false); }
  }

  const pending = items.filter((i) => !i.bought);
  const done    = items.filter((i) =>  i.bought);

  const inputCls = "bg-kitchen-surface text-kitchen-text text-sm px-3 py-2.5 outline-none focus:ring-1 ring-kitchen-accent/50 placeholder:text-kitchen-muted";
  const inputStyle: React.CSSProperties = { border: "1px solid var(--kitchen-line2)", borderRadius: "var(--radius-btn)" };

  return (
    <div className="space-y-5 pt-2">
      {/* Header */}
      <div>
        <MonoLabel className="text-kitchen-muted">GROCERY</MonoLabel>
        <h1 className="font-display font-normal mt-1" style={{ fontSize: 26, letterSpacing: "-0.02em" }}>
          {pending.length > 0
            ? <><span className="text-kitchen-accent">{pending.length}</span> to grab</>
            : "Shopping list"
          }
        </h1>
      </div>

      {/* Add input */}
      <form
        onSubmit={handleAdd}
        className="grocery-add-form"
        style={{
          border: "1px solid var(--kitchen-line2)",
          borderRadius: "var(--radius-card)",
          background: "rgb(var(--kitchen-card))",
          padding: "10px 12px",
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an item…"
          required
          className={`grocery-add-name ${inputCls} bg-transparent`}
          style={{ border: "none", borderRadius: 0, padding: "2px 0" }}
        />
        <div className="grocery-add-meta">
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="Qty"
            type="number"
            min="0"
            className={`grocery-add-qty ${inputCls}`}
            style={inputStyle}
          />
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit"
            className={`grocery-add-unit ${inputCls}`}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={adding || !name.trim()}
            className="grocery-add-submit px-3 py-2 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90 flex-shrink-0"
            style={{ background: "rgb(var(--kitchen-accent))", color: "rgb(26 18 10)", borderRadius: "var(--radius-btn)" }}
          >
            {adding ? "…" : "+"}
          </button>
        </div>
      </form>

      {/* AI suggestion chips */}
      {suggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-kitchen-accent text-xs">✦</span>
            <MonoLabel className="text-kitchen-accent">OFTEN RUN LOW</MonoLabel>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-[22px] px-[22px]">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => addSuggestion(s)}
                className="flex-shrink-0 text-xs text-kitchen-accent transition-opacity hover:opacity-80 px-3 py-1.5 font-mono"
                style={{
                  border: "1.5px dashed rgb(var(--kitchen-accent) / 0.5)",
                  borderRadius: 999,
                  background: "rgb(var(--kitchen-accent) / 0.05)",
                  letterSpacing: "0.04em",
                }}
              >
                + {s}
              </button>
            ))}
            <div className="flex-shrink-0 w-[22px]" />
          </div>
        </div>
      )}

      {/* Progress bar */}
      {items.length > 0 && (
        <div>
          <div
            className="h-[3px] rounded-full overflow-hidden"
            style={{ background: "var(--kitchen-line2)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(done.length / items.length) * 100}%`,
                background: "rgb(var(--kitchen-accent))",
              }}
            />
          </div>
          <MonoLabel className="text-kitchen-muted mt-1 block">
            {done.length} OF {items.length} IN CART
          </MonoLabel>
        </div>
      )}

      {error && (
        <p className="text-xs text-kitchen-danger px-3 py-2" style={{ background: "rgb(var(--kitchen-danger) / 0.08)", borderRadius: "var(--radius-btn)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="loading-shimmer h-14 rounded-card" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Pending items */}
          {pending.length > 0 && (
            <div>
              <MonoLabel className="text-kitchen-muted mb-2 block">TO BUY · {pending.length}</MonoLabel>
              <ul className="space-y-1.5">
                {pending.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      border: "1px solid var(--kitchen-line)",
                      borderRadius: "var(--radius-card)",
                      background: "rgb(var(--kitchen-card))",
                    }}
                  >
                    <CheckBox checked={false} onChange={() => toggleBought(item)} />
                    <span className="flex-1 text-sm text-kitchen-text">{item.ingredient_name}</span>
                    {item.quantity && (
                      <MonoLabel className="text-kitchen-muted">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </MonoLabel>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-kitchen-muted hover:text-kitchen-danger transition-colors text-base leading-none ml-1"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Done items */}
          {done.length > 0 && (
            <div>
              <MonoLabel className="text-kitchen-muted mb-2 block">BOUGHT · {done.length}</MonoLabel>
              <ul className="space-y-1.5">
                {done.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 opacity-50"
                    style={{
                      border: "1px solid var(--kitchen-line)",
                      borderRadius: "var(--radius-card)",
                      background: "rgb(var(--kitchen-surface))",
                    }}
                  >
                    <CheckBox checked={true} onChange={() => toggleBought(item)} />
                    <span className="flex-1 text-sm text-kitchen-muted line-through">{item.ingredient_name}</span>
                    {item.quantity && (
                      <MonoLabel className="text-kitchen-muted">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </MonoLabel>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-kitchen-muted hover:text-kitchen-danger transition-colors text-base leading-none ml-1"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {items.length === 0 && (
            <div
              className="py-12 text-center"
              style={{ border: "1px dashed var(--kitchen-line2)", borderRadius: "var(--radius-card)" }}
            >
              <p className="text-kitchen-muted text-sm">Your list is empty.</p>
              <p className="text-kitchen-muted text-xs mt-1">Add items above or pick from suggestions.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
