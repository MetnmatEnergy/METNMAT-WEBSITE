import type { CollectionConfig } from "payload";
import { isAdmin, publicRead } from "../access";

/**
 * Old-slug → category redirects, created automatically when a visible
 * category's slug changes so indexed URLs keep working (the website returns a
 * 301 from /shop/c/<oldSlug> to the current slug). System-managed.
 *
 * Separate from the product table on purpose — see the note in
 * ProductSlugRedirects.ts. The resolution rule also differs: Categories.access
 * .read is publicRead, so a HIDDEN category still populates through this
 * relationship and the website must re-check visibility before redirecting.
 */
export const CategorySlugRedirects: CollectionConfig = {
  slug: "category-slug-redirects",
  labels: { singular: "Category Slug Redirect", plural: "Category Slug Redirects" },
  admin: {
    group: "Catalog",
    useAsTitle: "oldSlug",
    defaultColumns: ["oldSlug", "category", "createdAt"],
    description: "Automatic 301 redirects for renamed category URLs (system-managed).",
    hidden: ({ user }) => !user,
  },
  access: {
    read: publicRead,
    create: () => false, // created by the Categories slug-change hook (overrideAccess)
    update: () => false,
    delete: isAdmin,
  },
  fields: [
    { name: "oldSlug", type: "text", required: true, unique: true, index: true },
    { name: "category", type: "relationship", relationTo: "categories", required: true, index: true },
  ],
  timestamps: true,
};
