import type { CollectionConfig } from "payload";
import { canReadAudit } from "../access";

/**
 * Append-only audit trail. Entries are written by collection hooks
 * (see src/hooks/audit.ts) via the Local API, never edited by hand.
 */
export const AuditLogs: CollectionConfig = {
  slug: "audit-logs",
  admin: {
    group: "Administration",
    useAsTitle: "documentLabel",
    defaultColumns: ["action", "collectionSlug", "documentLabel", "userEmail", "createdAt"],
  },
  access: {
    // canReadAudit, NOT isAdmin. The Administration permission area is
    // advertised as "read-only staff list, audit & integration logs" and the
    // read-only-auditor role as "read-only access to operational data + audit
    // logs". integration-logs already honoured that; this collection — the one
    // the helper is named for — did not, so the area named after the audit
    // trail could not open it. Widens READ only; the append-only rules below
    // are unchanged.
    read: canReadAudit,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "action",
      type: "select",
      options: [
        { label: "Create", value: "create" },
        { label: "Update", value: "update" },
        { label: "Delete", value: "delete" },
      ],
    },
    { name: "collectionSlug", type: "text" },
    { name: "documentId", type: "text" },
    { name: "documentLabel", type: "text" },
    { name: "user", type: "relationship", relationTo: "users" },
    { name: "userEmail", type: "text" },
  ],
  timestamps: true,
};
