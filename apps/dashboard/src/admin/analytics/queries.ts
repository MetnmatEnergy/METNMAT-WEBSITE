import type { Payload } from "payload";
import type { ResolvedRange } from "./range";
import { istDayStart, IST_OFFSET_MS } from "./range";

/**
 * Analytics read layer. Dashboards read the small analytics-daily rollups
 * first; distinct/bounce/duration and page/entity detail aggregate DB-side
 * over sessions and raw events with the compound indexes defined on those
 * collections (the Posts blog-stats $group precedent). Nothing here scans
 * unbounded data: every match is day-keyed, and raw events are TTL-capped.
 */

type AggModel = {
  aggregate: (pipeline: Record<string, unknown>[]) => { exec?: () => Promise<unknown[]> } | Promise<unknown[]>;
  find: (q: Record<string, unknown>, proj?: Record<string, unknown>) => {
    sort: (s: Record<string, number>) => { limit: (n: number) => { lean: () => Promise<unknown[]> } };
  };
  countDocuments?: (q: Record<string, unknown>) => Promise<number>;
};

const model = (payload: Payload, slug: string): AggModel =>
  (payload.db as unknown as { collections: Record<string, AggModel> }).collections[slug];

async function agg<T>(payload: Payload, slug: string, pipeline: Record<string, unknown>[]): Promise<T[]> {
  try {
    const res = model(payload, slug).aggregate(pipeline);
    const rows = "exec" in res && typeof res.exec === "function" ? await res.exec() : await (res as Promise<unknown[]>);
    return rows as T[];
  } catch {
    return [];
  }
}

// ── Rollups (analytics-daily) ────────────────────────────────────────────────

export type DailyRollup = {
  day: string;
  sessions?: number;
  pageViews?: number;
  ctaClicks?: number;
  outboundClicks?: number;
  formStarts?: number;
  formSubmits?: number;
  searches?: number;
  purchases?: number;
  purchaseTotal?: number;
  bySource?: Record<string, number>;
  byCountry?: Record<string, number>;
  byDevice?: Record<string, number>;
};

export async function rollupsFor(payload: Payload, days: string[]): Promise<DailyRollup[]> {
  if (days.length === 0) return [];
  return agg<DailyRollup>(payload, "analytics-daily", [
    { $match: { day: { $in: days } } },
    { $project: { _id: 0 } },
  ]);
}

export function sumRollups(rows: DailyRollup[]) {
  const total = {
    sessions: 0,
    pageViews: 0,
    ctaClicks: 0,
    outboundClicks: 0,
    formStarts: 0,
    formSubmits: 0,
    searches: 0,
    purchases: 0,
    purchaseTotal: 0,
    bySource: {} as Record<string, number>,
    byCountry: {} as Record<string, number>,
    byDevice: {} as Record<string, number>,
  };
  for (const r of rows) {
    total.sessions += r.sessions ?? 0;
    total.pageViews += r.pageViews ?? 0;
    total.ctaClicks += r.ctaClicks ?? 0;
    total.outboundClicks += r.outboundClicks ?? 0;
    total.formStarts += r.formStarts ?? 0;
    total.formSubmits += r.formSubmits ?? 0;
    total.searches += r.searches ?? 0;
    total.purchases += r.purchases ?? 0;
    total.purchaseTotal += r.purchaseTotal ?? 0;
    for (const [k, v] of Object.entries(r.bySource ?? {})) total.bySource[k] = (total.bySource[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.byCountry ?? {})) total.byCountry[k] = (total.byCountry[k] ?? 0) + v;
    for (const [k, v] of Object.entries(r.byDevice ?? {})) total.byDevice[k] = (total.byDevice[k] ?? 0) + v;
  }
  return total;
}

/** Per-day series aligned to the range (missing days → 0). */
export function seriesFrom(rows: DailyRollup[], days: string[], pick: (r: DailyRollup) => number): number[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return days.map((d) => {
    const r = byDay.get(d);
    return r ? pick(r) : 0;
  });
}

// ── Session-level stats (analytics-sessions) ─────────────────────────────────

export type SessionStats = {
  sessions: number;
  visitors: number;
  returningVisitors: number;
  bounces: number;
  totalDurationSec: number;
  totalPageViews: number;
  enquiryConversions: number;
  purchaseConversions: number;
};

export async function sessionStats(payload: Payload, days: string[]): Promise<SessionStats> {
  const zero: SessionStats = {
    sessions: 0,
    visitors: 0,
    returningVisitors: 0,
    bounces: 0,
    totalDurationSec: 0,
    totalPageViews: 0,
    enquiryConversions: 0,
    purchaseConversions: 0,
  };
  if (days.length === 0) return zero;
  const rows = await agg<{
    _id: null;
    sessions: number;
    bounces: number;
    dur: number;
    pv: number;
    enq: number;
    pur: number;
    vids: string[];
    multi: number;
  }>(payload, "analytics-sessions", [
    { $match: { day: { $in: days } } },
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        bounces: { $sum: { $cond: [{ $lte: ["$pageViews", 1] }, 1, 0] } },
        dur: { $sum: { $divide: [{ $subtract: ["$lastAt", "$startedAt"] }, 1000] } },
        pv: { $sum: "$pageViews" },
        enq: { $sum: { $cond: ["$convertedEnquiry", 1, 0] } },
        pur: { $sum: { $cond: ["$convertedPurchase", 1, 0] } },
        vids: { $addToSet: "$vid" },
      },
    },
  ]);
  const r = rows[0];
  if (!r) return zero;
  // Returning = visitors with 2+ sessions inside the window.
  const rep = await agg<{ _id: string; n: number }>(payload, "analytics-sessions", [
    { $match: { day: { $in: days } } },
    { $group: { _id: "$vid", n: { $sum: 1 } } },
    { $match: { n: { $gte: 2 } } },
    { $count: "n" },
  ]);
  return {
    sessions: r.sessions,
    visitors: r.vids?.length ?? 0,
    returningVisitors: (rep[0] as unknown as { n?: number })?.n ?? 0,
    bounces: r.bounces,
    totalDurationSec: Math.max(0, Math.round(r.dur || 0)),
    totalPageViews: r.pv,
    enquiryConversions: r.enq,
    purchaseConversions: r.pur,
  };
}

export type Dim = { key: string; sessions: number; enquiries?: number; purchases?: number; revenue?: number };

/** Sessions grouped by an arbitrary session dimension, with conversions. */
export async function sessionsBy(
  payload: Payload,
  days: string[],
  field: string,
  limit = 12,
  extraMatch: Record<string, unknown> = {}
): Promise<Dim[]> {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; sessions: number; enq: number; pur: number; rev: number }>(
    payload,
    "analytics-sessions",
    [
      { $match: { day: { $in: days }, ...extraMatch } },
      {
        $group: {
          _id: `$${field}`,
          sessions: { $sum: 1 },
          enq: { $sum: { $cond: ["$convertedEnquiry", 1, 0] } },
          pur: { $sum: { $cond: ["$convertedPurchase", 1, 0] } },
          rev: { $sum: { $ifNull: ["$purchaseTotal", 0] } },
        },
      },
      { $sort: { sessions: -1 } },
      { $limit: limit },
    ]
  );
  return rows
    .filter((r) => r._id)
    .map((r) => ({ key: String(r._id), sessions: r.sessions, enquiries: r.enq, purchases: r.pur, revenue: r.rev }));
}

/** Landing/exit page performance from sessions. */
export async function pagesBy(
  payload: Payload,
  days: string[],
  field: "entryPath" | "exitPath",
  limit = 10
): Promise<{ path: string; sessions: number; bounces: number; enquiries: number }[]> {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; sessions: number; bounces: number; enq: number }>(
    payload,
    "analytics-sessions",
    [
      { $match: { day: { $in: days } } },
      {
        $group: {
          _id: `$${field}`,
          sessions: { $sum: 1 },
          bounces: { $sum: { $cond: [{ $lte: ["$pageViews", 1] }, 1, 0] } },
          enq: { $sum: { $cond: ["$convertedEnquiry", 1, 0] } },
        },
      },
      { $sort: { sessions: -1 } },
      { $limit: limit },
    ]
  );
  return rows.filter((r) => r._id).map((r) => ({ path: String(r._id), sessions: r.sessions, bounces: r.bounces, enquiries: r.enq }));
}

// ── Raw-event aggregations (analytics-events) ────────────────────────────────

export async function topPages(payload: Payload, days: string[], limit = 12) {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; views: number; visitors: string[] }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: "page_view" } },
    { $group: { _id: "$path", views: { $sum: 1 }, visitors: { $addToSet: "$vid" } } },
    { $sort: { views: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ path: String(r._id), views: r.views, visitors: r.visitors?.length ?? 0 }));
}

export async function topEntities(payload: Payload, days: string[], entityType: string, limit = 10) {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; views: number }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: "page_view", entityType } },
    { $group: { _id: "$entitySlug", views: { $sum: 1 } } },
    { $sort: { views: -1 } },
    { $limit: limit },
  ]);
  return rows.filter((r) => r._id).map((r) => ({ slug: String(r._id), views: r.views }));
}

export async function topCtas(payload: Payload, days: string[], limit = 10) {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; clicks: number }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: "cta_click" } },
    { $group: { _id: "$meta.label", clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: limit },
  ]);
  return rows.filter((r) => r._id).map((r) => ({ label: String(r._id), clicks: r.clicks }));
}

export async function topSearches(payload: Payload, days: string[], limit = 12) {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; n: number }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: "search" } },
    { $group: { _id: "$meta.q", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: limit },
  ]);
  return rows.filter((r) => r._id).map((r) => ({ q: String(r._id), n: r.n }));
}

export async function outboundTargets(payload: Payload, days: string[], limit = 10) {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: string; n: number }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: "outbound_click" } },
    { $group: { _id: "$meta.to", n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: limit },
  ]);
  return rows.filter((r) => r._id).map((r) => ({ host: String(r._id), n: r.n }));
}

export async function formFunnel(payload: Payload, days: string[]) {
  if (days.length === 0) return [];
  const rows = await agg<{ _id: { form: string; type: string }; n: number }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: { $in: ["form_start", "form_submit"] } } },
    { $group: { _id: { form: "$meta.form", type: "$type" }, n: { $sum: 1 } } },
  ]);
  const forms = new Map<string, { form: string; starts: number; submits: number }>();
  for (const r of rows) {
    const name = String(r._id?.form ?? "");
    if (!name) continue;
    const f = forms.get(name) ?? { form: name, starts: 0, submits: 0 };
    if (r._id.type === "form_start") f.starts += r.n;
    else f.submits += r.n;
    forms.set(name, f);
  }
  return [...forms.values()].sort((a, b) => b.submits - a.submits);
}

/** Views heatmap: page_view counts per (IST hour × weekday). */
export async function viewsHeatmap(payload: Payload, days: string[]): Promise<number[][]> {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  if (days.length === 0) return grid;
  const rows = await agg<{ _id: { d: number; h: number }; n: number }>(payload, "analytics-events", [
    { $match: { day: { $in: days }, type: "page_view" } },
    {
      $group: {
        _id: {
          d: { $dayOfWeek: { date: "$ts", timezone: "+05:30" } }, // 1=Sun
          h: { $hour: { date: "$ts", timezone: "+05:30" } },
        },
        n: { $sum: 1 },
      },
    },
  ]);
  for (const r of rows) {
    const d = (r._id?.d ?? 1) - 1;
    const h = r._id?.h ?? 0;
    if (grid[d] && typeof grid[d][h] === "number") grid[d][h] += r.n;
  }
  return grid;
}

/** Per-page drill-down (Behavior). */
export async function pageDetail(payload: Payload, days: string[], path: string) {
  if (days.length === 0) return null;
  const rows = await agg<{ _id: string; views: number; visitors: string[]; dwell: number; scroll: number; leaves: number }>(
    payload,
    "analytics-events",
    [
      { $match: { day: { $in: days }, path } },
      {
        $group: {
          _id: "$path",
          views: { $sum: { $cond: [{ $eq: ["$type", "page_view"] }, 1, 0] } },
          visitors: { $addToSet: "$vid" },
          leaves: { $sum: { $cond: [{ $eq: ["$type", "page_leave"] }, 1, 0] } },
          dwell: { $sum: { $cond: [{ $eq: ["$type", "page_leave"] }, { $ifNull: ["$meta.dwell", 0] }, 0] } },
          scroll: { $sum: { $cond: [{ $eq: ["$type", "page_leave"] }, { $ifNull: ["$meta.scroll", 0] }, 0] } },
        },
      },
    ]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    path,
    views: r.views,
    visitors: r.visitors?.length ?? 0,
    avgDwellSec: r.leaves > 0 ? Math.round(r.dwell / r.leaves) : 0,
    avgScrollPct: r.leaves > 0 ? Math.round(r.scroll / r.leaves) : 0,
  };
}

// ── Real-time (last N minutes of raw events) ─────────────────────────────────

export async function realtimeSnapshot(payload: Payload, minutes = 5) {
  const since = new Date(Date.now() - minutes * 60_000);
  const rows = await agg<{
    _id: string;
    lastTs: Date;
    lastPath: string;
    vid: string;
    events: number;
  }>(payload, "analytics-events", [
    { $match: { createdAt: { $gte: since } } },
    { $sort: { ts: 1 } },
    {
      $group: {
        _id: "$sid",
        lastTs: { $last: "$ts" },
        lastPath: { $last: "$path" },
        vid: { $last: "$vid" },
        events: { $sum: 1 },
      },
    },
    { $sort: { lastTs: -1 } },
    { $limit: 50 },
  ]);
  // Join session context (source/device/geo) for the active sids.
  const sids = rows.map((r) => String(r._id));
  const sessions = sids.length
    ? await agg<{ sid: string; source?: string; channel?: string; device?: string; country?: string; entryPath?: string; startedAt?: Date }>(
        payload,
        "analytics-sessions",
        [{ $match: { sid: { $in: sids } } }, { $project: { _id: 0, sid: 1, source: 1, channel: 1, device: 1, country: 1, entryPath: 1, startedAt: 1 } }]
      )
    : [];
  const ctx = new Map(sessions.map((s) => [s.sid, s]));
  return rows.map((r) => ({
    sid: String(r._id),
    lastTs: r.lastTs,
    lastPath: r.lastPath,
    events: r.events,
    ...(ctx.get(String(r._id)) ?? {}),
  }));
}

/** Recent activity feed entries (real-time page). */
export async function recentEvents(payload: Payload, limit = 25) {
  try {
    const rows = await model(payload, "analytics-events")
      .find({}, { _id: 0, type: 1, path: 1, ts: 1, entityType: 1, entitySlug: 1, meta: 1 })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();
    return rows as { type: string; path: string; ts: Date; entityType?: string; entitySlug?: string; meta?: Record<string, unknown> }[];
  } catch {
    return [];
  }
}

// ── First-party data start (labelling honesty) ───────────────────────────────

export async function firstEventDay(payload: Payload): Promise<string | null> {
  const rows = await agg<{ day: string }>(payload, "analytics-daily", [
    { $sort: { day: 1 } },
    { $limit: 1 },
    { $project: { _id: 0, day: 1 } },
  ]);
  return rows[0]?.day ?? null;
}

/** Convert range days to a UTC window (for querying business collections). */
export function rangeToWindow(range: ResolvedRange): { from: Date; to: Date } {
  const from = new Date(istDayStart(range.days[0]));
  const to = new Date(istDayStart(range.days[range.days.length - 1]) + 86_400_000 - 1);
  return { from, to };
}

export { IST_OFFSET_MS };
