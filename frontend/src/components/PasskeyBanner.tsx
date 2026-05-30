"use client";

import { useState } from "react";
import { usePasskey } from "@/hooks/usePasskey";

export function PasskeyBanner() {
  const { supported, registered, registerPasskey } = usePasskey();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!supported || registered || dismissed || done) return null;

  async function handleEnable() {
    setBusy(true);
    setErr(null);
    try {
      await registerPasskey();
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-xs font-mono flex-shrink-0"
      style={{
        background: "rgb(var(--kitchen-accent) / 0.06)",
        borderBottom: "1px solid rgb(var(--kitchen-accent) / 0.15)",
        color: "rgb(var(--kitchen-accent))",
      }}
    >
      {err ? (
        <span className="flex-1" style={{ color: "rgb(239 68 68)" }}>{err}</span>
      ) : (
        <span className="flex-1">Enable biometric sign-in for faster access</span>
      )}
      <button
        onClick={handleEnable}
        disabled={busy}
        className="px-3 py-1 text-xs disabled:opacity-50"
        style={{
          background: "rgb(var(--kitchen-accent) / 0.15)",
          border: "1px solid rgb(var(--kitchen-accent) / 0.3)",
          borderRadius: "var(--radius-btn)",
          color: "rgb(var(--kitchen-accent))",
          cursor: "pointer",
        }}
      >
        {busy ? "Setting up…" : "Enable"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-kitchen-muted hover:text-kitchen-text transition-colors"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        Not now
      </button>
    </div>
  );
}
