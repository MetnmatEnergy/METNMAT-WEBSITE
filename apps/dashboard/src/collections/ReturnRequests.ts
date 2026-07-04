import type { CollectionConfig } from "payload";
import { canManageSupport, isStaff, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { returnBeforeChange } from "../hooks/workflow-gates";

/**
 * Return / replacement (RMA) requests against an order. Cannot be resolved/
 * closed without a resolution note (see returnBeforeChange).
 */
export const ReturnRequests: CollectionConfig = {
  slug: "return-requests",
  labels: { singular: "Return / Replacement", plural: "Returns & Replacements" },
  admin: {
    group: "Support",
    useAsTitle: "rmaNumber",
    defaultColumns: ["rmaNumber", "order", "action", "status", "createdAt"],
    description: "Return, replacement & refund requests.",
  },
  access: {
    read: isStaff,
    create: canManageSupport,
    update: canManageSupport,
    delete: isAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "rmaNumber", type: "text", index: true, admin: { width: "50%" } },
        {
          name: "status",
          type: "select",
          defaultValue: "requested",
          admin: { width: "50%" },
          options: [
            { label: "Requested", value: "requested" },
            { label: "Approved", value: "approved" },
            { label: "Rejected", value: "rejected" },
            { label: "In progress", value: "in-progress" },
            { label: "Resolved", value: "resolved" },
            { label: "Closed", value: "closed" },
          ],
        },
      ],
    },
    { name: "order", type: "relationship", relationTo: "orders", required: true },
    { name: "customer", type: "relationship", relationTo: "customers" },
    {
      type: "row",
      fields: [
        {
          name: "reason",
          type: "select",
          admin: { width: "50%" },
          options: [
            { label: "Damaged in transit", value: "damaged" },
            { label: "Defective", value: "defective" },
            { label: "Wrong item", value: "wrong-item" },
            { label: "Not as described", value: "not-as-described" },
            { label: "Other", value: "other" },
          ],
        },
        {
          name: "action",
          type: "select",
          admin: { width: "50%" },
          options: [
            { label: "Replace", value: "replace" },
            { label: "Refund", value: "refund" },
            { label: "Repair", value: "repair" },
          ],
        },
      ],
    },
    {
      name: "items",
      type: "array",
      labels: { singular: "Item", plural: "Items" },
      fields: [
        { name: "productName", type: "text", required: true },
        { name: "qty", type: "number", required: true },
      ],
    },
    { name: "refundAmount", type: "number", admin: { description: "₹, if a refund." } },
    { name: "replacementOrder", type: "relationship", relationTo: "orders", admin: { description: "Linked replacement order, if any." } },
    { name: "resolution", type: "textarea", admin: { description: "Required before Resolved/Closed." } },
    { name: "notes", type: "textarea" },
  ],
  hooks: {
    beforeChange: [returnBeforeChange],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
