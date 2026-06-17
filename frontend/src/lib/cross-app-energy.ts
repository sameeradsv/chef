import { getToken } from "@/lib/api";

const CORTEX_URL = (process.env.NEXT_PUBLIC_CORTEX_URL ?? "").replace(/\/$/, "");
const CIRCUIT_URL = (
  process.env.NEXT_PUBLIC_CIRCUIT_API_URL ?? process.env.NEXT_PUBLIC_CIRCUIT_URL ?? ""
).replace(/\/$/, "");
const CANOPY_URL = (
  process.env.NEXT_PUBLIC_CANOPY_API_URL ?? process.env.NEXT_PUBLIC_CANOPY_URL ?? ""
).replace(/\/$/, "");
const CHEF_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export interface EnergyTimelineEvent {
  time: string;
  delta?: number;
}

export interface EnergyTimeline {
  start_energy?: number;
  events: EnergyTimelineEvent[];
}

function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function eventMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function currentISTMinutes(): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const h = Number(parts.hour === "24" ? "0" : parts.hour);
  const m = Number(parts.minute);
  return h * 60 + m;
}

async function fetchTimeline(
  baseUrl: string,
  path: string,
  token: string,
): Promise<EnergyTimeline | null> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function isCortexAccount(token: string): Promise<boolean> {
  if (!CORTEX_URL) return false;
  try {
    const res = await fetch(`${CORTEX_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Same combined running balance as Canopy → Energy page:
 * Circuit start_energy (sleep + carry-over) + all deltas from Circuit, Canopy, and Chef today.
 */
export function computeCombinedEnergy(
  circuit: EnergyTimeline | null,
  canopy: EnergyTimeline | null,
  chef: EnergyTimeline | null,
  upToNow = true,
): { running: number; sources: string[] } | null {
  if (!circuit && !canopy && !chef) return null;

  const startEnergy = circuit?.start_energy ?? 0.7;
  const nowMin = currentISTMinutes();

  const allEvents = [
    ...(canopy?.events ?? []),
    ...(circuit?.events ?? []),
    ...(chef?.events ?? []),
  ]
    .filter((e) => e.time)
    .sort((a, b) => eventMinutes(a.time) - eventMinutes(b.time));

  const events = upToNow
    ? allEvents.filter((e) => eventMinutes(e.time) <= nowMin)
    : allEvents;

  const running = events.reduce(
    (balance, e) => Math.max(0, Math.min(1, balance + (e.delta ?? 0))),
    startEnergy,
  );

  const sources: string[] = [];
  if (circuit) sources.push("Circuit");
  if (canopy) sources.push("Canopy");
  if (chef) sources.push("Chef");

  return { running, sources };
}

/** Combined cross-app energy preset for Decide (mirrors Canopy Energy page total). */
export async function gatherCombinedEnergy(): Promise<{
  energy_level: number | null;
  fromCombined: boolean;
  sources: string[];
}> {
  const token = getToken();
  if (!token) return { energy_level: null, fromCombined: false, sources: [] };

  const cortex = await isCortexAccount(token);
  if (!cortex) return { energy_level: null, fromCombined: false, sources: [] };

  const date = todayIST();
  const q = `?date=${date}`;

  const [circuit, canopy, chef] = await Promise.all([
    CIRCUIT_URL ? fetchTimeline(CIRCUIT_URL, `/api/energy/timeline${q}`, token) : null,
    CANOPY_URL ? fetchTimeline(CANOPY_URL, `/api/sync/energy/timeline${q}`, token) : null,
    fetchTimeline(CHEF_URL, `/energy/timeline${q}`, token),
  ]);

  const combined = computeCombinedEnergy(circuit, canopy, chef, true);
  if (!combined) return { energy_level: null, fromCombined: false, sources: [] };

  return {
    energy_level: Math.max(1, Math.min(10, Math.round(combined.running * 10))),
    fromCombined: true,
    sources: combined.sources,
  };
}
