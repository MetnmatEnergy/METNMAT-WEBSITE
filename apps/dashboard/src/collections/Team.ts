import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Team / leadership profiles shown on the website's About/Team section.
 * Marketing+ can manage.
 */
export const Team: CollectionConfig = {
  slug: "team",
  labels: { singular: "Team Member", plural: "Team" },
  admin: {
    group: "Website Content",
    useAsTitle: "name",
    defaultColumns: ["name", "role", "order", "active"],
    description: "Team members shown on the website's About page.",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  fields: [
    { name: "name", type: "text", required: true },
    { name: "role", type: "text", admin: { description: "Job title, e.g. 'Founder & CEO'." } },
    { name: "photo", type: "upload", relationTo: "media" },
    { name: "bio", type: "textarea" },
    { name: "linkedin", type: "text", admin: { description: "LinkedIn profile URL (optional)." } },
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
