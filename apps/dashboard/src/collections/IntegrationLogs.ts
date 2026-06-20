import type { CollectionConfig } from "payload";
import { canReadAudit, internalOrCanManageCatalog } from "../access";

/**
 * Append-only log of outbound integration attempts (chatbot sync, website
 * revalidation, ticket-notify, Razorpay webhook, etc.) so fire-and-forget side
 * effects become durable and queryable instead of console-only.
 */
export const IntegrationLogs: CollectionConfig = {
  slug: "integration-logs",
  labels: { singular: "Integration Log", plural: "Integration Logs" },
  admin: {
    group: "Administration",
    useAsTitle: "integration",
    defaultColumns: ["integration", "status", "summary", "createdAt"],
    description: "Append-only log of outbound integration attempts.",
  },
  access: {
    read: canReadAudit,
    create: internalOrCanManageCatalog,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "integration", type: "text", admin: { width: "50%", description: "e.g. chatbot-sync, razorpay-webhook." } },
        {
          name: "status",
          type: "select",
          admin: { width: "50%" },
          options: [
            { label: "Success", value: "success" },
            { label: "Error", value: "error" },
          ],
        },
      ],
    },
    { name: "summary", type: "text" },
    { name: "error", type: "textarea" },
    { name: "durationMs", type: "number" },
    { name: "payload", type: "json" },
  ],
  timestamps: true,
};
