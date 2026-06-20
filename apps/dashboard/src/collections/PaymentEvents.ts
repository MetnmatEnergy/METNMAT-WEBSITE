import type { CollectionConfig } from "payload";
import { canManageAccounts, internalOrderOrManage } from "../access";

/**
 * Immutable log of Razorpay payment / webhook events. Written by the website
 * server (webhook, via the internal key) — never edited by hand. Gives an audit
 * trail for reconciliation, dispute handling, and double-charge detection.
 */
export const PaymentEvents: CollectionConfig = {
  slug: "payment-events",
  labels: { singular: "Payment Event", plural: "Payment Events" },
  admin: {
    group: "Sales",
    useAsTitle: "eventType",
    defaultColumns: ["eventType", "providerPaymentId", "amount", "signatureVerified", "createdAt"],
    description: "Append-only log of payment gateway events.",
  },
  access: {
    read: canManageAccounts,
    create: internalOrderOrManage, // the website webhook writes via the order-write key
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "provider", type: "text", defaultValue: "razorpay" },
    {
      type: "row",
      fields: [
        { name: "eventType", type: "text", admin: { width: "50%", description: "e.g. payment.captured" } },
        { name: "idempotencyKey", type: "text", index: true, admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "providerOrderId", type: "text", index: true, admin: { width: "50%" } },
        { name: "providerPaymentId", type: "text", index: true, admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "amount", type: "number", admin: { width: "33%", description: "Paise." } },
        { name: "currency", type: "text", defaultValue: "INR", admin: { width: "33%" } },
        { name: "signatureVerified", type: "checkbox", admin: { width: "34%" } },
      ],
    },
    { name: "processed", type: "checkbox", defaultValue: false },
    { name: "order", type: "relationship", relationTo: "orders" },
    { name: "rawPayload", type: "json", admin: { description: "Raw event payload from the provider." } },
  ],
  timestamps: true,
};
