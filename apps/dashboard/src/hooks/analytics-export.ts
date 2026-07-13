import type { Payload } from "payload";
import { istDayStart } from "../admin/analytics/range";
import { rollupsFor, sessionsBy, topPages, topSearches } from "../admin/analytics/queries";

/**
 * CSV export builders for the analytics suite. Exports honour the requested
 * date window, are bounded (day-keyed queries over indexed collections, capped
 * row counts), and quote/escape every cell — a value starting with =, +, - or @
 * is prefixed to defuse spreadsheet formula injection.
 */

const MAX_RANGE_DAYS = 366;

function daysBetween(from: string, to: string): string[] {
  const ok = /^\d{4}-\d{2}-\d{2}$/;
  if (!ok.test(from) || !ok.test(to) || from > to) return [];
  const out: string[] = [];
  let t = istDayStart(from);
  const end = istDayStart(to);
  while (t <= end && out.length < MAX_RANGE_DAYS) {
    out.push(new Date(t + 5.5 * 3600_000).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return out;
}

function cell(v: unknown): string {
  let s = String(v ?? "");
  // Defuse spreadsheet formula injection — include leading TAB (0x09) and CR
  // (0x0D), which Excel also treats as formula-triggering, not just =+-@.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

const rows = (header: string[], body: unknown[][]): string =>
  [header.map(cell).join(","), ...body.map((r) => r.map(cell).join(","))].join("\n") + "\n";

export async function exportAnalyticsCsv(
  payload: Payload,
  type: string,
  from: string,
  to: string
): Promise<string | null> {
  const days = daysBetween(from, to);
  if (days.length === 0) return rows(["error"], [["invalid or empty date range"]]);

  switch (type) {
    case "daily": {
      const data = await rollupsFor(payload, days);
      const byDay = new Map(data.map((d) => [d.day, d]));
      return rows(
        ["day", "sessions", "pageViews", "formStarts", "formSubmits", "searches", "ctaClicks", "outboundClicks", "purchases", "purchaseTotal"],
        days.map((d) => {
          const r = byDay.get(d);
          return [d, r?.sessions ?? 0, r?.pageViews ?? 0, r?.formStarts ?? 0, r?.formSubmits ?? 0, r?.searches ?? 0, r?.ctaClicks ?? 0, r?.outboundClicks ?? 0, r?.purchases ?? 0, r?.purchaseTotal ?? 0];
        })
      );
    }
    case "sessions": {
      const bySource = await sessionsBy(payload, days, "source", 50);
      return rows(
        ["source", "sessions", "enquiries", "orders", "revenue"],
        bySource.map((s) => [s.key, s.sessions, s.enquiries ?? 0, s.purchases ?? 0, s.revenue ?? 0])
      );
    }
    case "pages": {
      const pages = await topPages(payload, days, 200);
      return rows(["path", "views", "uniqueVisitors"], pages.map((p) => [p.path, p.views, p.visitors]));
    }
    case "searches": {
      const searches = await topSearches(payload, days, 200);
      return rows(["term", "count"], searches.map((s) => [s.q, s.n]));
    }
    default:
      return null;
  }
}
