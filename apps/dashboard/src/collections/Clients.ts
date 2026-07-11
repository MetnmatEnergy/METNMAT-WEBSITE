import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Clients, partners & institutions shown in the website's "Trusted by" logo
 * wall. `type` separates commercial clients from academic/research institutions.
 * Marketing+ can manage.
 */
export const Clients: CollectionConfig = {
  slug: "clients",
  labels: { singular: "Client / Partner", plural: "Clients & Partners" },
  admin: {
    group: "Site & Mobile App",
    useAsTitle: "name",
    defaultColumns: ["name", "type", "order", "active"],
    description: "Partner & institution logos shown on the homepage.",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "logo", type: "upload", relationTo: "media", required: true },
    { name: "url", type: "text", admin: { description: "Website URL (optional)." } },
    {
      name: "type",
      type: "select",
      defaultValue: "institution",
      admin: { description: "Commercial client vs academic / research institution." },
      options: [
        { label: "Company / Client", value: "company" },
        { label: "Institution / University", value: "institution" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "order", type: "number", defaultValue: 0, admin: { width: "50%", description: "Sort order." } },
        { name: "active", type: "checkbox", defaultValue: true, admin: { width: "50%", description: "Uncheck to hide." } },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
