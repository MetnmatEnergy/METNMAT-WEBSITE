import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";
import { inboundKeyMatches } from "../lib/internal-key";
import { ingestAnalyticsBatch } from "../hooks/analytics-ingest";

/**
 * Raw first-party analytics events (page views, clicks, form events, searches,
 * purchases) from the website collector. System-managed like Counters: rows
 * exist ONLY via the key-gated /ingest endpoint below — never through the
 * normal REST/admin create path. Raw events are the drill-down layer; the
 * dashboards read the analytics-daily rollups first.
 *
 * Retention: a TTL index on createdAt (ensured in payload.config onInit)
 * expires raw events after ANALYTICS_RAW_RETENTION_DAYS (default 180) — the
 * documented retention policy, enforced by Mongo itself with zero cron
 * infrastructure. Daily rollups are kept long-term.
 *
 * Privacy: no IPs, no names, no emails, no free-form user content beyond
 * capped/sanitised meta (search terms, CTA labels). Visitor ids are random
 * client-generated tokens with no linkage to customer accounts.
 */
export const AnalyticsEvents: CollectionConfig = {
  slug: "analytics-events",
  labels: { singular: "Analytics Event", plural: "Analytics Events" },
  admin: {
    group: "Administration",
    description: "Raw first-party website events (auto-expire per retention policy). Read-only.",
    defaultColumns: ["type", "path", "day", "createdAt"],
    hidden: ({ user }) => !user,
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin, // manual cleanup remains possible; TTL handles routine expiry
  },
  // Compound indexes for the dashboard's actual query patterns (BlogReactions
  // precedent). TTL on createdAt is raw-Mongo, ensured in onInit.
  indexes: [
    { fields: ["day", "type"] },
    { fields: ["entityType", "entitySlug", "day"] },
    { fields: ["path", "day"] },
    { fields: ["sid"] },
  ],
  fields: [
    {
      type: "row",
      fields: [
        { name: "type", type: "text", required: true, admin: { width: "34%", readOnly: true } },
        { name: "day", type: "text", required: true, index: true, admin: { width: "33%", readOnly: true, description: "IST day bucket (YYYY-MM-DD)." } },
        { name: "ts", type: "date", admin: { width: "33%", readOnly: true, description: "Client event time." } },
      ],
    },
    { name: "path", type: "text", admin: { readOnly: true } },
    {
      type: "row",
      fields: [
        { name: "entityType", type: "text", admin: { width: "50%", readOnly: true } },
        { name: "entitySlug", type: "text", admin: { width: "50%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "sid", type: "text", admin: { width: "50%", readOnly: true, description: "Session id (random token)." } },
        { name: "vid", type: "text", admin: { width: "50%", readOnly: true, description: "Anonymous visitor id (random token)." } },
      ],
    },
    { name: "meta", type: "json", admin: { readOnly: true, description: "Capped, sanitised extras (dwell, scroll, form, q, order…)." } },
  ],
  endpoints: [
    /**
     * POST /api/analytics-events/ingest — the website server's batch drop-off.
     * Key-gated (CMS_ANALYTICS_KEY, INTERNAL_API_KEY fallback). Inserts raw
     * events, upserts the session, and $inc's the daily rollups atomically —
     * all via raw mongoose models (Counters pattern), so ingestion never pays
     * Payload hook overhead and rollups need no cron.
     */
    {
      path: "/ingest",
      method: "post",
      handler: async (req) => {
        const { payload } = req;
        if (!inboundKeyMatches(req.headers.get("x-internal-key"), "CMS_ANALYTICS_KEY")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        let body: unknown;
        try {
          body = (await req.json?.()) ?? {};
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        try {
          const result = await ingestAnalyticsBatch(payload, body);
          return Response.json(result);
        } catch (e) {
          payload.logger.error(`[analytics/ingest] ${(e as Error).message}`);
          return Response.json({ error: "Ingest failed" }, { status: 500 });
        }
      },
    },
  ],
  timestamps: true,
};
