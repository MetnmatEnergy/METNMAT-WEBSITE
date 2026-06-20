import type { CollectionConfig } from "payload";
import { canManageAccounts, isLoggedIn, isSuperAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

/**
 * GST tax invoices for orders. Created/managed by Accounts; readable by staff.
 * Statutory document — not destructively deletable (super-admin only).
 */
export const Invoices: CollectionConfig = {
  slug: "invoices",
  admin: {
    group: "Sales",
    useAsTitle: "invoiceNumber",
    defaultColumns: ["invoiceNumber", "order", "total", "status", "issueDate"],
    description: "GST tax invoices.",
  },
  access: {
    read: isLoggedIn,
    create: canManageAccounts,
    update: canManageAccounts,
    delete: isSuperAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "invoiceNumber", type: "text", required: true, unique: true, index: true, admin: { width: "50%" } },
        {
          name: "status",
          type: "select",
          defaultValue: "draft",
          admin: { width: "50%" },
          options: [
            { label: "Draft", value: "draft" },
            { label: "Issued", value: "issued" },
            { label: "Paid", value: "paid" },
            { label: "Cancelled", value: "cancelled" },
          ],
        },
      ],
    },
    { name: "order", type: "relationship", relationTo: "orders" },
    { name: "customer", type: "relationship", relationTo: "customers" },
    {
      type: "row",
      fields: [
        { name: "issueDate", type: "date", admin: { width: "50%" } },
        { name: "dueDate", type: "date", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "subtotal", type: "number", admin: { width: "33%", description: "Taxable value (₹)." } },
        { name: "gstAmount", type: "number", admin: { width: "33%", description: "Total GST (₹)." } },
        { name: "total", type: "number", admin: { width: "34%", description: "Invoice total (₹)." } },
      ],
    },
    {
      name: "gstBreakup",
      type: "array",
      labels: { singular: "GST line", plural: "GST breakup" },
      fields: [
        {
          type: "row",
          fields: [
            { name: "rate", type: "number", admin: { width: "33%", description: "GST %." } },
            { name: "taxableValue", type: "number", admin: { width: "33%" } },
            { name: "taxAmount", type: "number", admin: { width: "34%" } },
          ],
        },
      ],
    },
    { name: "invoiceFile", type: "upload", relationTo: "documents", admin: { description: "Generated invoice PDF." } },
    { name: "notes", type: "textarea" },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
