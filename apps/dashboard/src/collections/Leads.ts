import type { CollectionConfig } from "payload";
import { canManageSales, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

/**
 * Sales leads — top-of-funnel prospects captured from any channel, separate from
 * formal RFQs (Enquiries). Worked by Sales.
 */
export const Leads: CollectionConfig = {
  slug: "leads",
  admin: {
    group: "Customers & Leads",
    useAsTitle: "name",
    defaultColumns: ["name", "company", "source", "status", "createdAt"],
    description: "Top-of-funnel sales leads.",
  },
  access: {
    read: canManageSales,
    create: canManageSales,
    update: canManageSales,
    delete: isAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, admin: { width: "50%" } },
        {
          name: "status",
          type: "select",
          defaultValue: "new",
          admin: { width: "50%" },
          options: [
            { label: "New", value: "new" },
            { label: "Contacted", value: "contacted" },
            { label: "Qualified", value: "qualified" },
            { label: "Converted", value: "converted" },
            { label: "Lost", value: "lost" },
          ],
        },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "email", type: "email", admin: { width: "50%" } },
        { name: "phone", type: "text", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "company", type: "text", admin: { width: "50%" } },
        {
          name: "source",
          type: "select",
          defaultValue: "manual",
          admin: { width: "50%" },
          options: [
            { label: "Website", value: "website" },
            { label: "WhatsApp", value: "whatsapp" },
            { label: "Amazon", value: "amazon" },
            { label: "Manual", value: "manual" },
            { label: "Referral", value: "referral" },
            { label: "Other", value: "other" },
          ],
        },
      ],
    },
    { name: "interest", type: "text", admin: { description: "What they're interested in." } },
    { name: "owner", type: "relationship", relationTo: "users" },
    { name: "nextFollowUpDate", type: "date" },
    { name: "notes", type: "textarea" },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
