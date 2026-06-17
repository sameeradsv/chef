/** All Chef API datetimes are naive IST wall-clock strings (YYYY-MM-DDTHH:MM:SS). */

export const TZ = "Asia/Kolkata";

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** True when value is a naive IST datetime string from the API (no Z / offset). */
export function isNaiveIST(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !/[zZ+-]\d/.test(value.slice(10));
}

/** Anchor a naive IST string for display formatting only — never send this to the API. */
export function istInstant(value: string | number | Date): Date {
  if (value instanceof Date) return value;
  const s = String(value).replace(" ", "T");
  if (isNaiveIST(s)) return new Date(`${s.slice(0, 19)}+05:30`);
  return new Date(s);
}

export function fmtDateIST(d: Date | string | number, opts: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {}): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(istInstant(d));
}

export function fmtTimeIST(d: Date | string | number): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(istInstant(d));
}

/** Format API IST string for `<input type="datetime-local">` (YYYY-MM-DDTHH:mm). */
export function toDatetimeLocalInput(ist?: string): string {
  if (ist) {
    const normalized = ist.replace(" ", "T");
    if (isNaiveIST(normalized)) return normalized.slice(0, 16);
    return toDatetimeLocalInputFromOffset(normalized);
  }
  return nowDatetimeLocal();
}

function toDatetimeLocalInputFromOffset(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** Current IST wall clock for datetime-local inputs. */
export function nowDatetimeLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

/** Send datetime-local value to API as naive IST (backend converts to UTC). */
export function datetimeLocalToIST(val: string): string {
  const normalized = val.replace(" ", "T");
  return normalized.length === 16 ? `${normalized}:00` : normalized.slice(0, 19);
}

export function istHour(d: Date = new Date()): number {
  return parseInt(new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", hour12: false }).format(d), 10);
}

export const MEAL_DAY_START_HOUR = 6;

/** YYYY-MM-DD in IST. */
export function istDateKey(d: Date | string | number): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(istInstant(d));
}

/** Meal-log day key — entries before 06:00 IST roll to the previous day. */
export function mealLogDateKey(d: Date | string | number): string {
  const key = istDateKey(d);
  const hour = typeof d === "string" ? istHour(istInstant(d)) : istHour(d instanceof Date ? d : istInstant(d));
  return hour < MEAL_DAY_START_HOUR ? addDaysIST(key, -1) : key;
}

/** Current meal-log day (before 06:00 IST still counts as yesterday). */
export function currentMealDayKey(): string {
  return mealLogDateKey(new Date());
}

export function addDaysIST(dateKey: string, delta: number): string {
  const base = new Date(`${dateKey}T12:00:00+05:30`);
  base.setTime(base.getTime() + delta * 86400000);
  return istDateKey(base);
}

export function startOfISTWeek(dateKey: string = todayIST()): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(`${dateKey}T12:00:00+05:30`));
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const daysFromMon = idx === 0 ? 6 : idx - 1;
  return addDaysIST(dateKey, -daysFromMon);
}

export function istWeekdayShort(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(new Date(`${dateKey}T12:00:00+05:30`)).slice(0, 3).toUpperCase();
}

function daysBetweenIST(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T12:00:00+05:30`);
  const b = new Date(`${toKey}T12:00:00+05:30`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** e.g. "Today, 6:30 pm" — all IST, no UTC conversion on the client. */
export function formatRelativeIST(ist: string): string {
  const dateKey = mealLogDateKey(ist);
  const diff = daysBetweenIST(dateKey, currentMealDayKey());
  const time = fmtTimeIST(ist);
  let label: string;
  if (diff === 0) label = "Today";
  else if (diff === 1) label = "Yesterday";
  else if (diff < 7) label = `${diff}d ago`;
  else label = fmtDateIST(ist, { day: "numeric", month: "short" });
  return `${label}, ${time}`;
}

export function istMinutesApart(a: string, b: string): number {
  return Math.abs(istInstant(a).getTime() - istInstant(b).getTime()) / 60000;
}

export type HistoryTimeFilter = "Week" | "Month" | "Year" | "All";

export function historyDateRange(filter: HistoryTimeFilter): { from?: string; to?: string } {
  const today = currentMealDayKey();
  if (filter === "All") return {};
  if (filter === "Week") return { from: startOfISTWeek(today), to: today };
  if (filter === "Month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}
