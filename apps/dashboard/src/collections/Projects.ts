import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Projects / case studies shown on the website's /projects page and the
 * homepage featured case study. Editable by content staff (marketing+).
 */
export const Projects: CollectionConfig = {
  slug: "projects",
  admin: {
    group: "Website Content",
    useAsTitle: "title",
    defaultColumns: ["title", "category", "order", "featured", "active"],
    description: "Case studies on the website's /projects page.",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  versions: { drafts: true },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "URL anchor, e.g. 'oxygen-free-copper-alloy'." },
    },
    {
      type: "row",
      fields: [
        { name: "category", type: "text", admin: { width: "60%", description: "e.g. 'Alloy Development'." } },
        { name: "client", type: "text", admin: { width: "40%", description: "Client / partner (optional)." } },
      ],
    },
    { name: "summary", type: "textarea", required: true, admin: { description: "Short summary shown on the project card." } },
    { name: "body", type: "richText", admin: { description: "Full case-study write-up (optional)." } },
    { name: "coverImage", type: "upload", relationTo: "media" },
    {
      name: "gallery",
      type: "array",
      labels: { singular: "Image", plural: "Gallery images" },
      fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
    },
    {
      type: "row",
      fields: [
        { name: "year", type: "number", admin: { width: "33%", description: "Year delivered (optional)." } },
        { name: "order", type: "number", defaultValue: 0, admin: { width: "33%", description: "Sort order (low first)." } },
        { name: "featured", type: "checkbox", defaultValue: false, admin: { width: "34%", description: "Feature on the homepage." } },
      ],
    },
    { name: "active", type: "checkbox", defaultValue: true, admin: { description: "Uncheck to hide from the website." } },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
