import type { CollectionConfig } from "payload";
import { canManageSettings } from "../access";

/**
 * Data Principal requests under the DPDP Act, 2023.
 *
 * Sections 11-14 give a Data Principal the right to obtain a summary of their
 * data, to correction and erasure, to grievance redressal, and to nominate.
 * An email address alone technically discharges that, but it leaves no record
 * of when a request arrived or whether it was answered in time — which is
 * exactly what a Data Fiduciary has to be able to show. Every request lands
 * here with a received timestamp and a due date.
 *
 * ACCESS IS DELIBERATELY LOPSIDED: create is public (the whole point is that
 * anyone can file one, including someone with no account), read/update are
 * staff-only. There is no public read anywhere, because a request contains the
 * requester's own contact details.
 *
 * Nothing here is auto-actioned. Erasure of a real customer record is a human
 * decision with legal retention to weigh (GST invoices must survive an erasure
 * request), so this collection tracks the obligation rather than executing it.
 */
export const DataRequests: CollectionConfig = {
  slug: "data-requests",
  labels: { singular: "Data Request", plural: "Data Requests (DPDP)" },
  admin: {
    group: "Administration",
    useAsTitle: "reference",
    defaultColumns: ["reference", "type", "email", "status", "receivedAt", "dueAt"],
    description:
      "Rights requests submitted from /privacy/request. Track each to closure — DPDP requires a documented grievance-redressal mechanism.",
  },
  access: {
    // Public create: the API route validates and rate-limits before calling in.
    create: () => true,
    read: canManageSettings,
    update: canManageSettings,
    delete: canManageSettings,
  },
  fields: [
    {
      name: "reference",
      type: "text",
      unique: true,
      index: true,
      admin: { readOnly: true, description: "Quoted to the requester so they can follow up." },
    },
    {
      name: "type",
      type: "select",
      required: true,
      options: [
        { label: "Access — summary of my data", value: "access" },
        { label: "Correction / completion", value: "correction" },
        { label: "Erasure", value: "erasure" },
        { label: "Withdraw consent", value: "withdraw" },
        { label: "Nominate another person", value: "nominate" },
        { label: "Grievance", value: "grievance" },
      ],
    },
    { name: "name", type: "text", required: true },
    { name: "email", type: "email", required: true, index: true },
    { name: "phone", type: "text" },
    {
      name: "details",
      type: "textarea",
      admin: { description: "What the requester asked for, in their own words." },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Verifying identity", value: "verifying" },
        { label: "In progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Rejected", value: "rejected" },
      ],
    },
    {
      name: "receivedAt",
      type: "date",
      admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } },
    },
    {
      name: "dueAt",
      type: "date",
      admin: {
        readOnly: true,
        date: { pickerAppearance: "dayAndTime" },
        description: "Received + the SLA set in Privacy & DPDP settings.",
      },
    },
    {
      name: "resolution",
      type: "textarea",
      admin: { description: "What was done, and when. This is the audit trail." },
    },
    {
      name: "sourceIpCountry",
      type: "text",
      admin: {
        readOnly: true,
        description: "Coarse origin only — full IPs are deliberately not stored.",
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== "create") return data;
        const now = new Date();
        // SLA comes from the Privacy global so ops can change it without a deploy.
        let days = 30;
        try {
          const g = (await req.payload.findGlobal({ slug: "privacy" })) as { responseDays?: number };
          if (typeof g?.responseDays === "number" && g.responseDays > 0) days = g.responseDays;
        } catch {
          /* fall back to 30 — never block a request over a settings read */
        }
        return {
          ...data,
          receivedAt: now.toISOString(),
          dueAt: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString(),
          status: data.status ?? "new",
          reference:
            data.reference ||
            `DPR-${now.getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        };
      },
    ],
  },
};
