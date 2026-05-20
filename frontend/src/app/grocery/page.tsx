"use client";

import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { api, GroceryItem } from "@/lib/api";

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listGrocery(), api.grocerySuggestions()])
      .then(([list, sugg]) => {
        setItems(list);
        setSuggestions(sugg);
      })
      .catch((e) => setError(e.message))
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
      setName("");
      setQty("");
      setUnit("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add item");
    } finally {
      setAdding(false);
    }
  }

  async function toggleBought(item: GroceryItem) {
    try {
      const updated = await api.updateGrocery(item.id, { bought: !item.bought });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch {
      // silently fail toggle
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteGrocery(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // silently fail delete
    }
  }

  async function addSuggestion(s: string) {
    setAdding(true);
    try {
      const item = await api.addGrocery({ ingredient_name: s });
      setItems((prev) => [item, ...prev]);
      setSuggestions((prev) => prev.filter((x) => x !== s));
    } catch {
      // ignore
    } finally {
      setAdding(false);
    }
  }

  const pending = items.filter((i) => !i.bought);
  const done = items.filter((i) => i.bought);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-2xl text-kitchen-text tracking-tight">Grocery List</h1>
          <p className="text-kitchen-muted text-sm mt-1">Track what you need to buy</p>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="bg-kitchen-surface border border-kitchen-border rounded-2xl p-5 space-y-3">
          <p className="text-sm font-medium text-kitchen-text">Add item</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingredient name"
              required
              className="flex-1 bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
            />
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              type="number"
              min="0"
              className="w-20 bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit"
              className="w-24 bg-kitchen-bg border border-kitchen-border rounded-lg px-3 py-2 text-sm text-kitchen-text placeholder:text-kitchen-muted focus:outline-none focus:border-kitchen-accent"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !name.trim()}
            className="bg-kitchen-accent text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {adding ? "Adding…" : "Add to list"}
          </button>
        </form>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-kitchen-muted uppercase tracking-wider">Suggested — missing from top recipes</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => addSuggestion(s)}
                  className="px-3 py-1.5 bg-kitchen-accentDim text-kitchen-accent text-sm rounded-full hover:bg-kitchen-accent hover:text-white transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-kitchen-danger bg-kitchen-danger/10 border border-kitchen-danger/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-kitchen-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending */}
            {pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-kitchen-muted uppercase tracking-wider">
                  To buy ({pending.length})
                </p>
                <ul className="space-y-1.5">
                  {pending.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 bg-kitchen-surface border border-kitchen-border rounded-xl px-4 py-3"
                    >
                      <button
                        onClick={() => toggleBought(item)}
                        className="w-5 h-5 rounded border-2 border-kitchen-border hover:border-kitchen-accent transition-colors flex-shrink-0"
                        aria-label="Mark as bought"
                      />
                      <span className="flex-1 text-sm text-kitchen-text">{item.ingredient_name}</span>
                      {item.quantity && (
                        <span className="text-xs text-kitchen-muted">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-kitchen-muted hover:text-kitchen-danger text-xs transition-colors"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Done */}
            {done.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-kitchen-muted uppercase tracking-wider">
                  Bought ({done.length})
                </p>
                <ul className="space-y-1.5">
                  {done.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 bg-kitchen-surface/50 border border-kitchen-border rounded-xl px-4 py-3 opacity-60"
                    >
                      <button
                        onClick={() => toggleBought(item)}
                        className="w-5 h-5 rounded border-2 border-kitchen-accent bg-kitchen-accent/20 transition-colors flex-shrink-0"
                        aria-label="Mark as not bought"
                      >
                        <span className="text-kitchen-accent text-xs flex items-center justify-center">✓</span>
                      </button>
                      <span className="flex-1 text-sm text-kitchen-muted line-through">{item.ingredient_name}</span>
                      {item.quantity && (
                        <span className="text-xs text-kitchen-muted">
                          {item.quantity} {item.unit}
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-kitchen-muted hover:text-kitchen-danger text-xs transition-colors"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {items.length === 0 && (
              <p className="text-center text-kitchen-muted text-sm py-8">
                Your grocery list is empty. Add items above or pick from suggestions.
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
