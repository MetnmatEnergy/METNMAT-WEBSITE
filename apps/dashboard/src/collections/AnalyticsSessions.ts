import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";

/**
 * Sessionized first-party analytics: one document per visitor session, upserted
 * at ingestion time (never via REST/admin). Carries FIRST-TOUCH attribution
 * (source/channel/UTM), coarse device + geography, entry/exit pages, activity
 * counters, and conversion flags. This collection powers sessions/visitors/
 * bounce/duration/source/geography KPIs; distinct-visitor counts aggregate over
 * it DB-side. Kept long-term (small: one doc per session, not per event).
 */
export const AnalyticsSessions: CollectionConfig = {
  slug: "analytics-sessions",
  labels: { singular: "Analytics Session", plural: "Analytics Sessions" },
  admin: {
    group: "Administration",
    description: "One row per website session (system-maintained). Read-only.",
    defaultColumns: ["day", "source", "channel", "country", "pageViews", "createdAt"],
    hidden: ({ user }) => !user,
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: isAdmin,
  },
  indexes: [
    { fields: ["day", "source"] },
    { fields: ["day", "country"] },
    { fields: ["vid", "day"] },
    // Session-journey explorer: day-range list sorted by start time.
    { fields: ["day", "startedAt"] },
  ],
  fields: [
    {
      type: "row",
      fields: [
        { name: "sid", type: "text", required: true, unique: true, index: true, admin: { width: "50%", readOnly: true } },
        { name: "vid", type: "text", index: true, admin: { width: "50%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "day", type: "text", required: true, index: true, admin: { width: "34%", readOnly: true } },
        { name: "startedAt", type: "date", admin: { width: "33%", readOnly: true } },
        { name: "lastAt", type: "date", admin: { width: "33%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "entryPath", type: "text", admin: { width: "50%", readOnly: true } },
        { name: "exitPath", type: "text", admin: { width: "50%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "pageViews", type: "number", defaultValue: 0, admin: { width: "50%", readOnly: true } },
        { name: "events", type: "number", defaultValue: 0, admin: { width: "50%", readOnly: true } },
      ],
    },
    // First-touch attribution (set once at session birth).
    {
      type: "row",
      fields: [
        { name: "source", type: "text", index: true, admin: { width: "34%", readOnly: true, description: "direct | organic | ai | social | email | paid | referral" } },
        { name: "channel", type: "text", admin: { width: "33%", readOnly: true, description: "google, chatgpt, linkedin, a referrer domain…" } },
        { name: "referrerDomain", type: "text", admin: { width: "33%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "utmSource", type: "text", admin: { width: "34%", readOnly: true } },
        { name: "utmMedium", type: "text", admin: { width: "33%", readOnly: true } },
        { name: "utmCampaign", type: "text", admin: { width: "33%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "utmTerm", type: "text", admin: { width: "50%", readOnly: true } },
        { name: "utmContent", type: "text", admin: { width: "50%", readOnly: true } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "device", type: "text", admin: { width: "34%", readOnly: true } },
        { name: "browser", type: "text", admin: { width: "33%", readOnly: true } },
        { name: "os", type: "text", admin: { width: "33%", readOnly: true } },
      ],
    },
    // Coarse geography — present only when a geo provider is configured.
    {
      type: "row",
      fields: [
        { name: "country", type: "text", index: true, admin: { width: "34%", readOnly: true } },
        { name: "region", type: "text", admin: { width: "33%", readOnly: true } },
        { name: "city", type: "text", admin: { width: "33%", readOnly: true } },
      ],
    },
    // Conversion flags (set when the matching events arrive in-session).
    {
      type: "row",
      fields: [
        { name: "convertedEnquiry", type: "checkbox", defaultValue: false, admin: { width: "34%", readOnly: true } },
        { name: "convertedPurchase", type: "checkbox", defaultValue: false, admin: { width: "33%", readOnly: true } },
        { name: "orderNumber", type: "text", admin: { width: "33%", readOnly: true } },
      ],
    },
    { name: "purchaseTotal", type: "number", admin: { readOnly: true, description: "₹ order total captured at the purchase event." } },
  ],
  timestamps: true,
};
