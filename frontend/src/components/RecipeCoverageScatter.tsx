"use client";

import { useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Recipe } from "@/lib/api";
import { useRouter } from "next/navigation";

interface ChartPoint {
  x: number;
  y: number;
  z: number;
  id: string;
  name: string;
  missing: number;
  match: number;
  difficulty: number;
}

function buildPoints(recipes: Recipe[]): ChartPoint[] {
  return recipes.map((r) => {
    const missing = r.ingredients.filter((i) => !i.in_pantry).length;
    return {
      x: missing,
      y: r.pantry_match_pct,
      z: Math.max(r.difficulty * 40, 40),
      id: r.id,
      name: r.name,
      missing,
      match: r.pantry_match_pct,
      difficulty: r.difficulty,
    };
  });
}

const DIFF_LABELS = ["", "Easy", "Moderate", "Hard", "Very hard", "Expert"];

interface TooltipPayload {
  payload: ChartPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "rgb(var(--kitchen-card))",
        border: "1px solid var(--kitchen-line2)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 11,
        fontFamily: "monospace",
        color: "rgb(var(--kitchen-text))",
        maxWidth: 180,
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>{d.name}</p>
      <p style={{ color: "rgb(var(--kitchen-accent))" }}>{d.match}% pantry match</p>
      <p style={{ color: "rgb(var(--kitchen-warn))" }}>{d.missing} missing</p>
      <p style={{ color: "rgb(var(--kitchen-ink3))" }}>{DIFF_LABELS[d.difficulty] ?? d.difficulty} difficulty</p>
      <p style={{ color: "rgb(var(--kitchen-muted))", marginTop: 4, fontSize: 10 }}>Tap to open →</p>
    </div>
  );
}

interface Props {
  recipes: Recipe[];
}

export default function RecipeCoverageScatter({ recipes }: Props) {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const points = buildPoints(recipes);
  if (recipes.length === 0) return null;

  const maxMissing = Math.max(...points.map((p) => p.x), 0);

  return (
    <div>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-mono tracking-[0.1em] text-kitchen-muted hover:text-kitchen-accent transition-colors mb-3"
        style={{ border: "1px solid var(--kitchen-line)", borderRadius: "var(--radius-btn)", background: "rgb(var(--kitchen-surface))" }}
      >
        <span>PANTRY COVERAGE MAP</span>
        <span>{show ? "▲" : "▼"}</span>
      </button>

      {show && (
        <div
          className="p-4"
          style={{
            border: "1px solid var(--kitchen-line)",
            borderRadius: "var(--radius-card)",
            background: "rgb(var(--kitchen-surface))",
          }}
        >
          <p className="text-[10px] font-mono text-kitchen-muted mb-1 uppercase tracking-[0.1em]">
            Coverage vs Missing Ingredients
          </p>
          <p className="text-xs text-kitchen-muted mb-4" style={{ lineHeight: 1.5 }}>
            Bottom-left = cook tonight · dot size = difficulty
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <XAxis
                type="number"
                dataKey="x"
                name="Missing"
                domain={[-0.5, maxMissing + 0.5]}
                label={{ value: "Missing ingredients", position: "insideBottom", offset: -2, fontSize: 9, fill: "rgb(var(--kitchen-ink3))", fontFamily: "monospace" }}
                tick={{ fontSize: 9, fill: "rgb(var(--kitchen-ink3))", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Match %"
                domain={[0, 100]}
                label={{ value: "Pantry %", angle: -90, position: "insideLeft", offset: 10, fontSize: 9, fill: "rgb(var(--kitchen-ink3))", fontFamily: "monospace" }}
                tick={{ fontSize: 9, fill: "rgb(var(--kitchen-ink3))", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <ZAxis type="number" dataKey="z" range={[30, 200]} />
              <ReferenceLine x={0} stroke="rgb(var(--kitchen-accent) / 0.2)" strokeDasharray="3 3" />
              <ReferenceLine y={80} stroke="rgb(var(--kitchen-success) / 0.2)" strokeDasharray="3 3" />
              <Tooltip content={<CustomTooltip />} />
              <Scatter
                data={points}
                fill="rgb(var(--kitchen-accent))"
                fillOpacity={0.65}
                cursor="pointer"
                onClick={(d: unknown) => {
                  const point = d as ChartPoint;
                  if (point?.id) router.push(`/recipe/${point.id}`);
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: "rgb(var(--kitchen-success) / 0.3)", border: "1px dashed rgb(var(--kitchen-success) / 0.6)" }} />
              <span className="text-[9px] font-mono text-kitchen-muted uppercase tracking-wide">80%+ match zone</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgb(var(--kitchen-accent))" }} />
              <span className="text-[9px] font-mono text-kitchen-muted uppercase tracking-wide">Tap dot to open</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
