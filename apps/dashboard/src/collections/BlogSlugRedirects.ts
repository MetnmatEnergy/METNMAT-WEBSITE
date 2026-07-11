import type { CollectionConfig } from "payload";
import { isAdmin, publicRead } from "../access";

/**
 * Old-slug → article redirects, created automatically when a published
 * article's slug changes so indexed URLs keep working (the website returns a
 * 301 from /blog/<oldSlug> to the current slug). System-managed.
 */
export const BlogSlugRedirects: CollectionConfig = {
  slug: "blog-slug-redirects",
  labels: { singular: "Blog Slug Redirect", plural: "Blog Slug Redirects" },
  admin: {
    group: "Blog",
    useAsTitle: "oldSlug",
    defaultColumns: ["oldSlug", "article", "createdAt"],
    description: "Automatic 301 redirects for renamed article URLs (system-managed).",
    hidden: ({ user }) => !user,
  },
  access: {
    read: publicRead, // the website resolves old URLs anonymously
    create: () => false, // created by the Posts slug-change hook (overrideAccess)
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: "oldSlug", type: "text", required: true, unique: true, index: true },
    { name: "article", type: "relationship", relationTo: "posts", required: true, index: true },
  ],
  timestamps: true,
};
