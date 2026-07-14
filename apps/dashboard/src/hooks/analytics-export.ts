import type { Payload } from "payload";
import { istDayStart } from "../admin/analytics/range";
import { rollupsFor, sessionsBy, topPages, topSearches, pagesBy } from "../admin/analytics/queries";

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
  // Quote on CR too, not just LF/comma/quote: an unquoted embedded \r makes Excel
  // start a NEW row whose first field could begin with =/+/-/@ — re-opening the
  // injection the leading-char guard just closed. Quoting keeps it one cell.
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Excel-friendly CSV: UTF-8 BOM (so non-ASCII search terms/paths aren't mojibake
// on Windows) + CRLF line endings (the CSV standard Excel expects).
const BOM = "\uFEFF";
const rows = (header: string[], body: unknown[][]): string =>
  BOM + [header.map(cell).join(","), ...body.map((r) => r.map(cell).join(","))].join("\r\n") + "\r\n";

export async function exportAnalyticsCsv(
  payload: Payload,
  type: string,
  from: string,
  to: string
): Promise<string | null> {
  const days = daysBetween(from, to);
  // Invalid/empty range → null so the route answers 400, NOT a 200 download whose
  // only content is the word "error" (which looks like a successful export).
  if (days.length === 0) return null;

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
    case "sessions":
    case "channels": {
      // Traffic by acquisition channel with a named conversion rate. "orders" and
      // "revenue" are the CLIENT-OBSERVED purchase signal (under-counts webhook-
      // paid orders — authoritative revenue lives in the Orders collection), so
      // the columns say so and no one mistakes them for finance figures.
      const bySource = await sessionsBy(payload, days, "source", 50);
      return rows(
        ["channel", "sessions", "enquiries", "enquiry_rate_pct", "orders_client_observed", "revenue_client_observed"],
        bySource.map((s) => [
          s.key,
          s.sessions,
          s.enquiries ?? 0,
          s.sessions > 0 ? (((s.enquiries ?? 0) / s.sessions) * 100).toFixed(1) : "0.0",
          s.purchases ?? 0,
          s.revenue ?? 0,
        ])
      );
    }
    case "referrers": {
      const refs = await sessionsBy(payload, days, "referrerDomain", 200, { referrerDomain: { $ne: "" } });
      return rows(
        ["referrer_domain", "sessions", "enquiries"],
        refs.map((r) => [r.key, r.sessions, r.enquiries ?? 0])
      );
    }
    case "campaigns": {
      const camps = await sessionsBy(payload, days, "utmCampaign", 200, { utmCampaign: { $ne: "" } });
      return rows(
        ["utm_campaign", "sessions", "enquiries", "orders_client_observed"],
        camps.map((c) => [c.key, c.sessions, c.enquiries ?? 0, c.purchases ?? 0])
      );
    }
    case "devices": {
      const dev = await sessionsBy(payload, days, "device", 20);
      return rows(
        ["device", "sessions", "enquiries"],
        dev.map((d) => [d.key, d.sessions, d.enquiries ?? 0])
      );
    }
    case "geography": {
      const geo = await sessionsBy(payload, days, "country", 200, { country: { $ne: "" } });
      return rows(
        ["country", "sessions", "enquiries"],
        geo.map((g) => [g.key, g.sessions, g.enquiries ?? 0])
      );
    }
    case "pages": {
      const pages = await topPages(payload, days, 200);
      return rows(["path", "views", "uniqueVisitors"], pages.map((p) => [p.path, p.views, p.visitors]));
    }
    case "landing": {
      const land = await pagesBy(payload, days, "entryPath", 200);
      return rows(
        ["landing_page", "sessions", "bounces", "enquiries"],
        land.map((p) => [p.path, p.sessions, p.bounces, p.enquiries])
      );
    }
    case "searches": {
      const searches = await topSearches(payload, days, 200);
      return rows(["term", "count"], searches.map((s) => [s.q, s.n]));
    }
    default:
      return null;
  }
}
