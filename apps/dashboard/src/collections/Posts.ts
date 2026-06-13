import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Blog / news posts shown on the website's /blog and /blog/[slug] pages and
 * the homepage "From the lab" teaser. Drafts supported. Marketing+ can manage.
 */
export const Posts: CollectionConfig = {
  slug: "posts",
  labels: { singular: "Blog Post", plural: "Blog Posts" },
  admin: {
    group: "Website Content",
    useAsTitle: "title",
    defaultColumns: ["title", "category", "author", "publishedDate", "_status"],
    description: "Blog / news articles on the website.",
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
      admin: { description: "URL segment, e.g. 'iacs-oxygen-free-copper'." },
    },
    { name: "excerpt", type: "textarea", required: true, admin: { description: "Short summary shown on the blog card." } },
    {
      type: "row",
      fields: [
        { name: "category", type: "text", admin: { width: "33%", description: "e.g. 'Insights', 'Materials'." } },
        { name: "author", type: "text", admin: { width: "33%" } },
        { name: "publishedDate", type: "date", admin: { width: "34%", date: { pickerAppearance: "dayOnly" } } },
      ],
    },
    { name: "readingTime", type: "text", admin: { description: "e.g. '5 min read'." } },
    { name: "coverImage", type: "upload", relationTo: "media" },
    { name: "body", type: "richText", admin: { description: "The article body." } },
    {
      name: "tags",
      type: "array",
      labels: { singular: "Tag", plural: "Tags" },
      fields: [{ name: "tag", type: "text", required: true }],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
