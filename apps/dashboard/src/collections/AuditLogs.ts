import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";

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
    read: isAdmin,
    create: () => false, // only the server (hooks) creates these
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
