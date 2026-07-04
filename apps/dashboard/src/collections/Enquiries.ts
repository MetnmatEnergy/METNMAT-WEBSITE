import type { CollectionConfig } from "payload";
import { canManageSales, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { enquiryBeforeChange } from "../hooks/workflow-gates";

/**
 * Customization / quote requests (RFQ) submitted from the website's
 * "Request for Customization" drawer. Anyone can CREATE (public form);
 * only staff can read/manage. Sales + Marketing + Admin can work them.
 */
export const Enquiries: CollectionConfig = {
  slug: "enquiries",
  labels: { singular: "Enquiry (RFQ)", plural: "Enquiries (RFQ)" },
  admin: {
    group: "Sales",
    useAsTitle: "name",
    defaultColumns: ["name", "productName", "status", "email", "createdAt"],
    description: "Customization & quote requests from the website.",
  },
  access: {
    create: () => true, // public website form submits here
    read: canManageSales, // super-admin / admin / marketing / sales
    update: canManageSales,
    delete: isAdmin,
  },
  fields: [
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      admin: { position: "sidebar" },
      options: [
        { label: "New", value: "new" },
        { label: "File verification pending", value: "file-verification-pending" },
        { label: "Technical review", value: "technical-review" },
        { label: "Feasible", value: "feasible" },
        { label: "Not feasible", value: "not-feasible" },
        { label: "Pricing pending", value: "pricing-pending" },
        { label: "Quotation approval pending", value: "quotation-approval-pending" },
        { label: "Quotation sent", value: "quotation-sent" },
        { label: "Follow-up due", value: "follow-up-due" },
        { label: "Won", value: "won" },
        { label: "Lost", value: "lost" },
        { label: "Closed", value: "closed" },
        // Legacy values (kept so existing records display correctly).
        { label: "Quoted (legacy)", value: "quoted" },
        { label: "Accepted (legacy)", value: "accepted" },
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
    { name: "source", type: "text", admin: { position: "sidebar", readOnly: true } },

    // Customer
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text" },
        { name: "company", type: "text" },
      ],
    },

    // Product context (auto-filled from the website)
    {
      type: "row",
      fields: [
        { name: "productName", type: "text" },
        { name: "productSku", type: "text", label: "Product code" },
      ],
    },
    { name: "productSlug", type: "text", admin: { readOnly: true } },

    // Their requirement
    { name: "design", type: "textarea" },
    {
      type: "row",
      fields: [
        { name: "size", type: "text" },
        { name: "material", type: "text" },
        { name: "quantity", type: "text" },
      ],
    },
    { name: "message", type: "textarea", admin: { description: "Full submitted summary." } },

    // Files the customer attached (PDF / image / camera photo).
    {
      name: "attachments",
      type: "upload",
      relationTo: "enquiry-uploads",
      hasMany: true,
      admin: { description: "Files the customer attached (PDF / image / photo)." },
    },

    // ── Workflow (internal) ──────────────────────────────────────────────────
    {
      type: "collapsible",
      label: "Workflow & ownership",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            { name: "assignedSalesOwner", type: "relationship", relationTo: "users", admin: { width: "50%" } },
            { name: "assignedTechnicalOwner", type: "relationship", relationTo: "users", admin: { width: "50%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "expectedValue", type: "number", admin: { width: "50%", description: "Estimated deal value (₹)." } },
            { name: "quoteAmount", type: "number", admin: { width: "50%", description: "Quoted amount (₹)." } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "quotation", type: "relationship", relationTo: "quotations", admin: { width: "50%", description: "Linked quotation." } },
            { name: "quotationRef", type: "text", admin: { width: "50%", description: "Quotation number/reference (required to mark 'Quotation sent')." } },
          ],
        },
        { name: "quotationFile", type: "upload", relationTo: "documents", admin: { description: "Quotation PDF (alternative to a reference)." } },
        {
          type: "row",
          fields: [
            { name: "nextFollowUpDate", type: "date", admin: { width: "50%" } },
            { name: "lastContactedDate", type: "date", admin: { width: "50%" } },
          ],
        },
        { name: "technicalNote", type: "textarea", admin: { description: "Technical feasibility note (required to mark 'Not feasible')." } },
        {
          type: "row",
          fields: [
            { name: "closeReason", type: "text", admin: { width: "50%", description: "Required to mark Closed." } },
            { name: "lossReason", type: "text", admin: { width: "50%", description: "Required to mark Lost." } },
          ],
        },
        { name: "internalNotes", type: "textarea", admin: { description: "Internal only — never shown to the customer." } },
        { name: "customerVisibleNotes", type: "textarea", admin: { description: "Notes that may be shared with the customer." } },
      ],
    },
  ],
  hooks: {
    beforeChange: [enquiryBeforeChange],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
