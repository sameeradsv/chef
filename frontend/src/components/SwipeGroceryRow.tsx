"use client";

import { useRef, useState, type ReactNode } from "react";

const SWIPE_THRESHOLD = 72;

export function SwipeGroceryRow({
  children,
  onMarkBought,
  label = "Mark bought",
}: {
  children: ReactNode;
  onMarkBought: () => void;
  label?: string;
}) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragging.current = true;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    setOffset(Math.max(-SWIPE_THRESHOLD, Math.min(0, dx)));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (offset <= -SWIPE_THRESHOLD * 0.6) {
      onMarkBought();
      setOffset(0);
    } else {
      setOffset(0);
    }
  }

  return (
    <div className="relative overflow-hidden" style={{ borderRadius: "var(--radius-card)" }}>
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center text-xs font-mono font-medium"
        style={{
          width: SWIPE_THRESHOLD,
          background: "rgb(var(--kitchen-accent))",
          color: "rgb(26 18 10)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}
