import type { CollectionConfig } from "payload";
import { internalTicketOrManage, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { notifyTicketReply } from "../hooks/ticket-notify";

/**
 * Customer support tickets. Raised from the website (post-order help) by the
 * WEBSITE SERVER via the shared x-internal-key — never by the public directly.
 * Staff work them here: status workflow, priority, assignment, and a two-way
 * message thread the customer sees on the website's status lookup.
 */
export const Tickets: CollectionConfig = {
  slug: "tickets",
  labels: { singular: "Support Ticket", plural: "Support Tickets" },
  admin: {
    group: "Inbox",
    useAsTitle: "ticketNumber",
    defaultColumns: ["ticketNumber", "subject", "status", "priority", "name", "createdAt"],
    description: "Customer support tickets from the website.",
  },
  access: {
    // Website server (ticket-write key) creates/reads/updates; staff manage.
    create: internalTicketOrManage,
    read: internalTicketOrManage,
    update: internalTicketOrManage,
    delete: isAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "ticketNumber", type: "text", required: true, unique: true, index: true, admin: { width: "50%", readOnly: true } },
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "open",
          admin: { width: "50%", position: "sidebar" },
          options: [
            { label: "Open", value: "open" },
            { label: "In progress", value: "in-progress" },
            { label: "Waiting on customer", value: "waiting" },
            { label: "Resolved", value: "resolved" },
            { label: "Closed", value: "closed" },
          ],
        },
      ],
    },
    {
      name: "priority",
      type: "select",
      defaultValue: "normal",
      admin: { position: "sidebar" },
      options: [
        { label: "Low", value: "low" },
        { label: "Normal", value: "normal" },
        { label: "High", value: "high" },
        { label: "Urgent", value: "urgent" },
      ],
    },
    { name: "assignedTo", type: "relationship", relationTo: "users", admin: { position: "sidebar" } },

    {
      name: "category",
      type: "select",
      defaultValue: "order-issue",
      options: [
        { label: "Order issue", value: "order-issue" },
        { label: "Product quality / damage", value: "product-quality" },
        { label: "Shipping & delivery", value: "shipping-delivery" },
        { label: "Payment & billing", value: "payment-billing" },
        { label: "Technical support", value: "technical-support" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "subject", type: "text", required: true },
    { name: "description", type: "textarea", required: true, admin: { description: "The customer's original issue." } },

    // Linked order
    {
      type: "row",
      fields: [
        { name: "orderNumber", type: "text", index: true, admin: { width: "50%", description: "Related order (if any)." } },
        { name: "order", type: "relationship", relationTo: "orders", admin: { width: "50%" } },
      ],
    },

    // Customer
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
      ],
    },
    { name: "phone", type: "text" },

    // Files the customer attached (photos of damage, invoices, etc.)
    {
      name: "attachments",
      type: "relationship",
      relationTo: "enquiry-uploads",
      hasMany: true,
      admin: { description: "Files the customer attached." },
    },

    // Two-way conversation (customer sees this on the website status page)
    {
      name: "messages",
      type: "array",
      labels: { singular: "Message", plural: "Conversation" },
      admin: { description: "Replies here from staff are emailed to the customer and shown on their status page." },
      fields: [
        {
          name: "from",
          type: "select",
          required: true,
          defaultValue: "staff",
          options: [
            { label: "Staff", value: "staff" },
            { label: "Customer", value: "customer" },
          ],
        },
        { name: "authorName", type: "text" },
        { name: "body", type: "textarea", required: true },
        { name: "createdAt", type: "date", admin: { readOnly: true } },
      ],
    },

    { name: "internalNotes", type: "textarea", admin: { description: "Private staff notes — never shown to the customer." } },
    { name: "source", type: "text", admin: { position: "sidebar", readOnly: true } },
  ],
  hooks: {
    afterChange: [auditAfterChange, notifyTicketReply],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
