import type { CollectionConfig } from "payload";
import { isAdmin, publicRead } from "../access";

/**
 * Old-slug → product redirects, created automatically when a published
 * product's slug changes so indexed URLs keep working (the website returns a
 * 301 from /shop/p/<oldSlug> to the current slug). System-managed.
 *
 * The mirror of BlogSlugRedirects. Separate from the category table because
 * `products.slug` and `categories.slug` are unique within their OWN collections
 * and live at different URL prefixes — "crucibles" can legitimately be both. One
 * shared table keeping this unique index would refuse the second redirect, and
 * the writing hook swallows errors, so it would be lost silently.
 */
export const ProductSlugRedirects: CollectionConfig = {
  slug: "product-slug-redirects",
  labels: { singular: "Product Slug Redirect", plural: "Product Slug Redirects" },
  admin: {
    group: "Catalog",
    useAsTitle: "oldSlug",
    defaultColumns: ["oldSlug", "product", "createdAt"],
    description: "Automatic 301 redirects for renamed product URLs (system-managed).",
    hidden: ({ user }) => !user,
  },
  access: {
    read: publicRead, // the website resolves old URLs anonymously
    create: () => false, // created by the Products slug-change hook (overrideAccess)
    update: () => false,
    // isAdmin, not canManageCatalog: matches BlogSlugRedirects and widens nothing.
    delete: isAdmin,
  },
  fields: [
    { name: "oldSlug", type: "text", required: true, unique: true, index: true },
    { name: "product", type: "relationship", relationTo: "products", required: true, index: true },
  ],
  timestamps: true,
};
