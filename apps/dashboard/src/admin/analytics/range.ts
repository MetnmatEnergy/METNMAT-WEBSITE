/**
 * Date-range engine for the analytics dashboards — pure functions (unit-tested
 * from /test). All bucketing is in IST, the business timezone used everywhere
 * else (invoice FY, daily rollups).
 *
 * A range resolves to inclusive IST day strings ["YYYY-MM-DD", …] plus the
 * matching comparison window (previous period of equal length, previous year,
 * or none). KPI deltas guard division-by-zero: prev=0 → "New", both 0 → "—".
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export type RangeKey =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "90d"
  | "this-month"
  | "prev-month"
  | "this-year"
  | "custom";

export type CompareKey = "prev" | "year" | "none";

export type ResolvedRange = {
  key: RangeKey;
  compare: CompareKey;
  /** Inclusive IST day strings, oldest → newest. */
  days: string[];
  /** Comparison window of equal length (empty when compare === "none"). */
  compareDays: string[];
  label: string;
  compareLabel: string;
};

const DAY_MS = 86_400_000;

/** IST calendar day for an instant. */
export function istDayOf(epochMs: number): string {
  return new Date(epochMs + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Epoch ms at IST midnight of a "YYYY-MM-DD" day. */
export function istDayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS;
}

function dayRange(startDay: string, endDay: string): string[] {
  const out: string[] = [];
  let t = istDayStart(startDay); // UTC ms of IST midnight
  const end = istDayStart(endDay);
  while (t <= end && out.length < 400) {
    out.push(istDayOf(t));
    t += DAY_MS;
  }
  return out;
}

function shiftDays(days: string[], byDays: number): string[] {
  return days.map((d) => istDayOf(istDayStart(d) + byDays * DAY_MS));
}

function fmt(day: string): string {
  const d = new Date(istDayStart(day) + IST_OFFSET_MS);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function resolveRange(params: {
  range?: string | null;
  from?: string | null;
  to?: string | null;
  compare?: string | null;
  now?: number;
}): ResolvedRange {
  const now = params.now ?? Date.now();
  const today = istDayOf(now);
  const key = ([
    "today",
    "yesterday",
    "7d",
    "30d",
    "90d",
    "this-month",
    "prev-month",
    "this-year",
    "custom",
  ] as RangeKey[]).includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : "30d";
  const compare: CompareKey = params.compare === "none" ? "none" : params.compare === "year" ? "year" : "prev";

  let start = today;
  let end = today;
  const ist = new Date(now + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();

  switch (key) {
    case "today":
      break;
    case "yesterday":
      start = end = istDayOf(now - DAY_MS);
      break;
    case "7d":
      start = istDayOf(now - 6 * DAY_MS);
      break;
    case "30d":
      start = istDayOf(now - 29 * DAY_MS);
      break;
    case "90d":
      start = istDayOf(now - 89 * DAY_MS);
      break;
    case "this-month":
      start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      break;
    case "prev-month": {
      const pm = new Date(Date.UTC(y, m - 1, 1));
      const last = new Date(Date.UTC(y, m, 0));
      start = pm.toISOString().slice(0, 10);
      end = last.toISOString().slice(0, 10);
      break;
    }
    case "this-year":
      start = `${y}-01-01`;
      break;
    case "custom": {
      const okDay = /^\d{4}-\d{2}-\d{2}$/;
      const from = okDay.test(params.from ?? "") ? (params.from as string) : istDayOf(now - 29 * DAY_MS);
      const to = okDay.test(params.to ?? "") ? (params.to as string) : today;
      start = from <= to ? from : to;
      end = to >= from ? to : from;
      if (end > today) end = today;
      break;
    }
  }

  const days = dayRange(start, end);
  let compareDays: string[] = [];
  if (compare === "prev") compareDays = shiftDays(days, -days.length);
  else if (compare === "year") compareDays = shiftDays(days, -365);

  const label = days.length === 1 ? fmt(days[0]) : `${fmt(days[0])} – ${fmt(days[days.length - 1])}`;
  const compareLabel =
    compare === "none" || compareDays.length === 0
      ? ""
      : compareDays.length === 1
        ? fmt(compareDays[0])
        : `${fmt(compareDays[0])} – ${fmt(compareDays[compareDays.length - 1])}`;

  return { key, compare, days, compareDays, label, compareLabel };
}

/** KPI delta with honest zero handling — never "Infinity%". */
export function delta(current: number, previous: number): { text: string; up: boolean; abs: number } {
  const abs = current - previous;
  if (previous === 0) return { text: current > 0 ? "New" : "—", up: current >= 0, abs };
  const pct = (abs / previous) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, up: pct >= 0, abs };
}
