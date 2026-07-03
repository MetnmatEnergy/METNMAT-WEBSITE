import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { slugify } from "../lib/blog";

/**
 * Blog content types (Technical Article, Research Note, Case Study, …) —
 * CMS-managed so the editorial team can add/retire types without a deploy.
 */
export const BlogContentTypes: CollectionConfig = {
  slug: "blog-content-types",
  labels: { singular: "Blog Content Type", plural: "Blog Content Types" },
  admin: {
    group: "Website Content",
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "isActive", "displayOrder"],
    description: "Article formats (Technical Article, Research Note, Case Study, …).",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      unique: true,
      index: true,
      admin: { description: "Auto-generated from the name when left blank." },
      hooks: {
        beforeValidate: [({ value, data }) => slugify((value as string) || data?.name || "")],
      },
    },
    { name: "description", type: "textarea" },
    {
      type: "row",
      fields: [
        { name: "isActive", type: "checkbox", defaultValue: true, admin: { width: "50%" } },
        { name: "displayOrder", type: "number", defaultValue: 0, admin: { width: "50%" } },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
  timestamps: true,
};
