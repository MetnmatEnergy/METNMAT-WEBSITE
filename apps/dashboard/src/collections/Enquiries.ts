import type { CollectionConfig } from "payload";
import { canManageCatalog, isAdmin } from "../access";

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
    read: canManageCatalog, // super-admin / admin / marketing / sales
    update: canManageCatalog,
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
        { label: "Quoted", value: "quoted" },
        { label: "Accepted", value: "accepted" },
        { label: "Closed", value: "closed" },
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
  ],
  timestamps: true,
};
