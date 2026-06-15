export const TZ = "Asia/Kolkata";

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function fmtDateIST(d: Date | string | number, opts: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {}): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(new Date(d as string));
}

export function fmtTimeIST(d: Date | string | number): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(d as string));
}

export function toISTDatetimeLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

export function fromISTDatetimeLocal(val: string): string {
  return new Date(val + "+05:30").toISOString();
}

export function istHour(d: Date = new Date()): number {
  return parseInt(new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", hour12: false }).format(d), 10);
}
