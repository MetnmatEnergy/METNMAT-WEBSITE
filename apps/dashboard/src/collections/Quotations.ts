import type { CollectionConfig } from "payload";
import { canManageCatalog, isSuperAdmin, fieldAccountsOrInternal } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { quotationBeforeChange } from "../hooks/workflow-gates";

/**
 * Formal price quotations raised against an RFQ (Enquiry). Workflow:
 * draft → internal-review → approved → sent → accepted / rejected / expired.
 * Only Accounts/Admin can approve; only an approved quote (with a PDF) can be sent.
 */
export const Quotations: CollectionConfig = {
  slug: "quotations",
  labels: { singular: "Quotation", plural: "Quotations" },
  admin: {
    group: "Sales",
    useAsTitle: "quotationNumber",
    defaultColumns: ["quotationNumber", "company", "status", "total", "validUntil"],
    description: "Formal price quotations against RFQs.",
  },
  access: {
    read: canManageCatalog,
    create: canManageCatalog,
    update: canManageCatalog,
    delete: isSuperAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "quotationNumber", type: "text", required: true, unique: true, index: true, admin: { width: "50%" } },
        {
          name: "status",
          type: "select",
          defaultValue: "draft",
          admin: { width: "50%" },
          options: [
            { label: "Draft", value: "draft" },
            { label: "Internal review", value: "internal-review" },
            { label: "Approved", value: "approved" },
            { label: "Sent", value: "sent" },
            { label: "Accepted", value: "accepted" },
            { label: "Rejected", value: "rejected" },
            { label: "Expired", value: "expired" },
          ],
        },
      ],
    },
    { name: "enquiry", type: "relationship", relationTo: "enquiries", admin: { description: "Source RFQ." } },
    { name: "customer", type: "relationship", relationTo: "customers" },
    {
      type: "row",
      fields: [
        { name: "contactName", type: "text" },
        { name: "company", type: "text" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "email", type: "email" },
        { name: "phone", type: "text" },
      ],
    },
    {
      name: "lineItems",
      type: "array",
      labels: { singular: "Line item", plural: "Line items" },
      fields: [
        { name: "description", type: "text", required: true },
        {
          type: "row",
          fields: [
            { name: "qty", type: "number", required: true, admin: { width: "33%" } },
            { name: "unitPrice", type: "number", required: true, admin: { width: "33%", description: "₹ (excl. GST)." } },
            { name: "lineTotal", type: "number", admin: { width: "34%", description: "₹." } },
          ],
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "subtotal", type: "number", admin: { width: "33%" } },
        { name: "taxAmount", type: "number", admin: { width: "33%", description: "GST (₹)." } },
        { name: "total", type: "number", admin: { width: "34%" } },
      ],
    },
    { name: "validUntil", type: "date" },
    { name: "paymentTerms", type: "textarea" },
    { name: "deliveryTerms", type: "textarea" },
    { name: "warrantyTerms", type: "textarea" },
    {
      name: "quotationFile",
      type: "upload",
      relationTo: "documents",
      admin: { description: "Quotation PDF — required before the status can become Sent." },
    },
    {
      type: "row",
      fields: [
        { name: "preparedBy", type: "relationship", relationTo: "users", admin: { width: "50%" } },
        {
          name: "approvedBy",
          type: "relationship",
          relationTo: "users",
          access: { update: fieldAccountsOrInternal },
          admin: { width: "50%", description: "Set on commercial approval (Accounts/Admin)." },
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "revisionNumber", type: "number", defaultValue: 1, admin: { width: "50%" } },
        { name: "sentAt", type: "date", admin: { width: "50%", readOnly: true } },
      ],
    },
    { name: "customerResponse", type: "textarea" },
    { name: "notes", type: "textarea", admin: { description: "Internal notes (not shown to the customer)." } },
  ],
  hooks: {
    beforeChange: [quotationBeforeChange],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
