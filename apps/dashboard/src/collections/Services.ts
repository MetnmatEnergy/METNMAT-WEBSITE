import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Services shown on the website's /services page and the homepage
 * "What we do" preview. Editable by content staff (marketing+).
 */
export const Services: CollectionConfig = {
  slug: "services",
  admin: {
    group: "Site & Mobile App",
    useAsTitle: "title",
    defaultColumns: ["title", "order", "featured", "active"],
    description: "Services on the website's /services page and homepage.",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "URL anchor, e.g. 'product-process-development'." },
    },
    { name: "summary", type: "textarea", required: true, admin: { description: "One- or two-line description shown on the service card." } },
    {
      name: "icon",
      type: "select",
      defaultValue: "rocket",
      admin: { description: "Icon shown on the card." },
      options: [
        { label: "Rocket", value: "rocket" },
        { label: "Lightbulb", value: "lightbulb" },
        { label: "Gauge", value: "gauge" },
        { label: "Target", value: "target" },
        { label: "Flame", value: "flame" },
        { label: "CPU / Chip", value: "cpu" },
        { label: "Microscope", value: "microscope" },
        { label: "Factory", value: "factory" },
      ],
    },
    { name: "description", type: "richText", admin: { description: "Optional longer write-up for the service detail section." } },
    { name: "image", type: "upload", relationTo: "media" },
    {
      type: "row",
      fields: [
        { name: "order", type: "number", defaultValue: 0, admin: { width: "33%", description: "Sort order (low first)." } },
        { name: "featured", type: "checkbox", defaultValue: false, admin: { width: "33%", description: "Show on the homepage." } },
        { name: "active", type: "checkbox", defaultValue: true, admin: { width: "34%", description: "Uncheck to hide from the website." } },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
