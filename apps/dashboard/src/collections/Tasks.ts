import type { CollectionConfig } from "payload";
import { isLoggedIn, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { taskBeforeChange } from "../hooks/workflow-gates";

/**
 * Internal work items — follow-ups, quotation prep, technical review, dispatch,
 * payment checks, support. A task cannot be marked Done without a completion
 * note (and a quotation task needs a linked quotation first).
 */
export const Tasks: CollectionConfig = {
  slug: "tasks",
  admin: {
    group: "Operations",
    useAsTitle: "title",
    defaultColumns: ["title", "taskType", "assignedTo", "status", "dueDate"],
    description: "Internal work items and assignments.",
  },
  access: {
    read: isLoggedIn,
    create: isLoggedIn,
    update: isLoggedIn,
    delete: isAdmin,
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "description", type: "textarea" },
    {
      type: "row",
      fields: [
        {
          name: "taskType",
          type: "select",
          defaultValue: "custom",
          admin: { width: "50%" },
          options: [
            { label: "Follow-up", value: "follow-up" },
            { label: "Quotation", value: "quotation" },
            { label: "Technical review", value: "technical-review" },
            { label: "Dispatch", value: "dispatch" },
            { label: "Payment", value: "payment" },
            { label: "Support", value: "support" },
            { label: "Custom", value: "custom" },
          ],
        },
        {
          name: "priority",
          type: "select",
          defaultValue: "normal",
          admin: { width: "50%" },
          options: [
            { label: "Low", value: "low" },
            { label: "Normal", value: "normal" },
            { label: "High", value: "high" },
            { label: "Urgent", value: "urgent" },
          ],
        },
      ],
    },
    {
      name: "status",
      type: "select",
      defaultValue: "pending",
      admin: { position: "sidebar" },
      options: [
        { label: "Pending", value: "pending" },
        { label: "In progress", value: "in-progress" },
        { label: "Blocked", value: "blocked" },
        { label: "Review required", value: "review-required" },
        { label: "Done", value: "done" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "assignedTo", type: "relationship", relationTo: "users", admin: { width: "50%" } },
        { name: "dueDate", type: "date", admin: { width: "50%" } },
      ],
    },
    { name: "relatedCustomer", type: "relationship", relationTo: "customers" },
    { name: "relatedEnquiry", type: "relationship", relationTo: "enquiries" },
    { name: "relatedQuotation", type: "relationship", relationTo: "quotations" },
    { name: "relatedOrder", type: "relationship", relationTo: "orders" },
    { name: "completionNote", type: "textarea", admin: { description: "Required before the task can be marked Done." } },
    { name: "completionEvidence", type: "upload", relationTo: "documents" },
    {
      type: "row",
      fields: [
        { name: "approvalRequired", type: "checkbox", admin: { width: "33%" } },
        { name: "approvedBy", type: "relationship", relationTo: "users", admin: { width: "33%" } },
        { name: "approvedAt", type: "date", admin: { width: "34%", readOnly: true } },
      ],
    },
    { name: "createdBy", type: "relationship", relationTo: "users" },
  ],
  hooks: {
    beforeChange: [taskBeforeChange],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
