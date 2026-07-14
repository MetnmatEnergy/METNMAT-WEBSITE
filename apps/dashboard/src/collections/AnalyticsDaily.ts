import type { CollectionConfig } from "payload";
import { isAdmin, hasRole } from "../access";
import { exportAnalyticsCsv } from "../hooks/analytics-export";

/**
 * Daily analytics rollups — one document per IST day, incremented atomically
 * ($inc via the Counters raw-model pattern) at INGESTION time. This is what
 * makes the dashboards cheap: date-range queries read a handful of small
 * indexed docs instead of scanning raw events. Kept forever (tiny).
 *
 * Map fields (bySource/byCountry/byDevice) hold bounded-cardinality counters
 * keyed by session dimensions — sources are a fixed vocabulary, countries are
 * ISO-ish codes, devices are three values. Page-level metrics deliberately
 * live in raw-event aggregation (unbounded key space doesn't belong in one doc).
 */
export const AnalyticsDaily: CollectionConfig = {
  slug: "analytics-daily",
  labels: { singular: "Analytics Day", plural: "Analytics Daily Rollups" },
  admin: {
    group: "Administration",
    description: "Per-day rollups powering the analytics dashboards. System-maintained.",
    defaultColumns: ["day", "sessions", "pageViews", "formSubmits", "purchases"],
    hidden: ({ user }) => !user,
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: "day", type: "text", required: true, unique: true, index: true, admin: { readOnly: true } },
    {
      type: "row",
      fields: [
        { name: "sessions", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "pageViews", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "ctaClicks", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "outboundClicks", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "formStarts", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "formSubmits", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "searches", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
        { name: "purchases", type: "number", defaultValue: 0, admin: { width: "25%", readOnly: true } },
      ],
    },
    { name: "purchaseTotal", type: "number", defaultValue: 0, admin: { readOnly: true, description: "₹ sum of purchase events (client-observed; authoritative revenue = Orders)." } },
    { name: "bySource", type: "json", admin: { readOnly: true, description: "Session counts per traffic source." } },
    { name: "byCountry", type: "json", admin: { readOnly: true, description: "Session counts per country (when geo is configured)." } },
    { name: "byDevice", type: "json", admin: { readOnly: true, description: "Session counts per device class." } },
  ],
  endpoints: [
    /**
     * GET /api/analytics-daily/export?type=daily|sessions|pages|searches&from=YYYY-MM-DD&to=YYYY-MM-DD
     * CSV export for the All Reports page. STAFF-ONLY: authenticated via the
     * normal admin cookie; storefront customers are rejected (their tokens also
     * populate req.user, so the collection check is load-bearing).
     */
    {
      path: "/export",
      method: "get",
      handler: async (req) => {
        // Analytics is admin-only (the collections are read: isAdmin). This
        // endpoint reads via the raw model layer, which bypasses collection
        // access — so the role check here is the ONLY gate. collection==="users"
        // rejects storefront-customer tokens; hasRole rejects non-admin staff.
        const user = req.user as { collection?: string; roles?: string[] } | null;
        if (!user || user.collection !== "users") {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!hasRole(user as Parameters<typeof hasRole>[0], "super-admin", "admin")) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        try {
          const url = new URL(req.url ?? "http://x/");
          const type = url.searchParams.get("type") ?? "daily";
          const from = url.searchParams.get("from") ?? "";
          const to = url.searchParams.get("to") ?? "";
          const csv = await exportAnalyticsCsv(req.payload, type, from, to);
          if (csv === null) return Response.json({ error: "Invalid report type or date range" }, { status: 400 });
          // Build the download filename from SANITISED params (raw query values
          // must never reach a Content-Disposition header, where a quote/newline
          // could inject header content or a misleading name).
          const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "report";
          const filename = `metnmat-analytics-${safe(type)}-${safe(from)}-${safe(to)}.csv`;
          return new Response(csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          req.payload.logger.error(`[analytics/export] ${(e as Error).message}`);
          return Response.json({ error: "Export failed" }, { status: 500 });
        }
      },
    },
  ],
  timestamps: true,
};
