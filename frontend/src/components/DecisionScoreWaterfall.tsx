"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DecisionOption } from "@/lib/api";

const MODE_LABELS: Record<string, string> = {
  cook: "Cook",
  order: "Order",
  eat_out: "Eat out",
};

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildChartData(factors: Record<string, number>) {
  return Object.entries(factors)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([key, value]) => ({ name: formatKey(key), value }));
}

interface Props {
  options: DecisionOption[];
}

export default function DecisionScoreWaterfall({ options }: Props) {
  const [activeMode, setActiveMode] = useState<string>(options[0]?.mode ?? "cook");

  const active = options.find((o) => o.mode === activeMode) ?? options[0];
  if (!active) return null;

  const data = buildChartData(active.factors);
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div
      className="p-4 space-y-3"
      style={{
        border: "1px solid var(--kitchen-line)",
        borderRadius: "var(--radius-card)",
        background: "rgb(var(--kitchen-surface))",
      }}
    >
      {/* Header + tabs */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono tracking-[0.12em] text-kitchen-muted uppercase">
          Score Breakdown
        </span>
        <div className="flex gap-1">
          {options.map((o) => (
            <button
              key={o.mode}
              type="button"
              onClick={() => setActiveMode(o.mode)}
              className="px-2.5 py-0.5 text-[10px] font-mono tracking-[0.08em] transition-all"
              style={{
                borderRadius: 999,
                border:
                  activeMode === o.mode
                    ? "1px solid rgb(var(--kitchen-accent) / 0.5)"
                    : "1px solid var(--kitchen-line)",
                background:
                  activeMode === o.mode
                    ? "rgb(var(--kitchen-accent) / 0.1)"
                    : "transparent",
                color:
                  activeMode === o.mode
                    ? "rgb(var(--kitchen-accent))"
                    : "rgb(var(--kitchen-ink3))",
              }}
            >
              {MODE_LABELS[o.mode] ?? o.mode}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={data.length * 36 + 16}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            domain={[-maxAbs * 1.1, maxAbs * 1.1]}
            tick={{ fontSize: 9, fill: "rgb(var(--kitchen-ink3))", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v > 0 ? `+${v}` : String(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 10, fill: "rgb(var(--kitchen-ink3))", fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine x={0} stroke="var(--kitchen-line2)" strokeWidth={1} />
          <Tooltip
            cursor={{ fill: "rgb(var(--kitchen-accent) / 0.05)" }}
            contentStyle={{
              background: "rgb(var(--kitchen-card))",
              border: "1px solid var(--kitchen-line2)",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "monospace",
              color: "rgb(var(--kitchen-text))",
            }}
            formatter={(val) => {
              const v = Number(val);
              return [`${v > 0 ? "+" : ""}${v}`, "Score"] as [string, string];
            }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.value >= 0
                    ? "rgb(var(--kitchen-success))"
                    : "rgb(var(--kitchen-warn))"
                }
                fillOpacity={0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Total score row */}
      <div
        className="flex justify-between items-center px-3 py-2"
        style={{
          borderTop: "1px solid var(--kitchen-line)",
          marginTop: 4,
        }}
      >
        <span className="text-[10px] font-mono text-kitchen-muted uppercase tracking-[0.1em]">
          Total score
        </span>
        <span
          className="text-sm font-mono font-medium"
          style={{ color: "rgb(var(--kitchen-accent))" }}
        >
          {active.score > 0 ? "+" : ""}
          {active.score}
        </span>
      </div>
    </div>
  );
}
