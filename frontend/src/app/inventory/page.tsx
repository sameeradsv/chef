"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, LoadingCard } from "@/components/Card";
import { api, type Ingredient } from "@/lib/api";
import { expiryBadge } from "@/lib/utils";

const STORAGE_FILTERS = ["all", "fridge", "pantry", "freezer"];

const emptyForm = {
  name: "",
  quantity: 0,
  unit: "grams",
  expiry_date: "",
  storage_type: "fridge",
  opened: false,
  cost: 0,
};

export default function InventoryPage() {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getIngredients(
        filter !== "all" ? { storage: filter } : undefined
      );
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity),
      cost: Number(form.cost),
      expiry_date: form.expiry_date || undefined,
    };
    if (editing) {
      await api.updateIngredient(editing.id, payload);
    } else {
      await api.createIngredient(payload);
    }
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  }

  function startEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      expiry_date: ing.expiry_date?.slice(0, 10) || "",
      storage_type: ing.storage_type,
      opened: ing.opened,
      cost: ing.cost,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this ingredient?")) return;
    await api.deleteIngredient(id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display">Pantry</h2>
          <p className="text-sm text-kitchen-muted">
            Expiry and freshness computed on the server
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setShowForm(true);
          }}
          className="px-4 py-2 rounded-lg bg-kitchen-accent text-kitchen-bg font-medium text-sm hover:bg-kitchen-accentDim transition-colors"
        >
          + Add ingredient
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STORAGE_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
              filter === s
                ? "bg-kitchen-accent/20 text-kitchen-accent"
                : "bg-kitchen-card text-kitchen-muted hover:text-kitchen-text"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-kitchen-muted">Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-kitchen-muted">Quantity</span>
              <input
                type="number"
                required
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-kitchen-muted">Unit</span>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-kitchen-muted">Expiry date</span>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) =>
                  setForm({ ...form, expiry_date: e.target.value })
                }
                className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-kitchen-muted">Storage</span>
              <select
                value={form.storage_type}
                onChange={(e) =>
                  setForm({ ...form, storage_type: e.target.value })
                }
                className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
              >
                <option value="fridge">Fridge</option>
                <option value="pantry">Pantry</option>
                <option value="freezer">Freezer</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-kitchen-muted">Cost (₹)</span>
              <input
                type="number"
                value={form.cost}
                onChange={(e) =>
                  setForm({ ...form, cost: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg bg-kitchen-bg border border-kitchen-border px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.opened}
                onChange={(e) =>
                  setForm({ ...form, opened: e.target.checked })
                }
              />
              <span className="text-sm">Opened</span>
            </label>
            <div className="sm:col-span-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-kitchen-accent text-kitchen-bg text-sm font-medium"
              >
                {editing ? "Save" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
                className="px-4 py-2 rounded-lg border border-kitchen-border text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          <LoadingCard />
          <LoadingCard />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <p className="text-kitchen-muted">No ingredients yet. Add your pantry.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((ing) => {
            const badge = expiryBadge(ing.days_until_expiry);
            return (
              <li key={ing.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-medium">{ing.name}</p>
                      <p className="text-sm text-kitchen-muted">
                        {ing.quantity} {ing.unit} · {ing.storage_type}
                        {ing.opened && " · opened"}
                      </p>
                      <p className="text-xs text-kitchen-muted mt-1">
                        Freshness {ing.freshness_score}/10
                        {ing.cost > 0 && ` · ₹${ing.cost}`}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(ing)}
                        className="text-xs text-kitchen-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ing.id)}
                        className="text-xs text-kitchen-danger hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
