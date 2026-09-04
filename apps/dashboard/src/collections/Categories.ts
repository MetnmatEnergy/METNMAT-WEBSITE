import type { CollectionConfig } from "payload";
import { canManageCatalog, publicRead } from "../access";
import { slugify } from "../lib/blog";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { categoryBeforeDelete } from "../hooks/category-guards";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
// A category rename changes products' subcategory label (and can shift the bot's
// 5-value enum bucket), so a category edit must also resync the chatbot catalog.
import { syncChatbotAfterChange, syncChatbotAfterDelete } from "../hooks/sync-chatbot";

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: { group: "Catalog", useAsTitle: "name", defaultColumns: ["name", "parent", "slug"] },
  access: {
    read: publicRead,
    create: canManageCatalog,
    update: canManageCatalog,
    delete: canManageCatalog,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: { description: "URL segment, e.g. 'crucibles'. Auto-generated from the name when blank." },
      // Normalise so a hand-typed value ("Raw Materials & Alloys") can't become a
      // broken public URL, and fill from the name when left empty. Matches
      // Products/Projects/Posts.
      hooks: {
        beforeValidate: [({ value, data }) => slugify((value as string) || (data?.name as string) || "")],
      },
    },
    { name: "blurb", type: "text" },
    {
      name: "parent",
      type: "relationship",
      relationTo: "categories",
      admin: { description: "Leave empty for a top-level department." },
    },
    { name: "image", type: "upload", relationTo: "media" },
    { name: "order", type: "number", defaultValue: 0, admin: { description: "Sort order." } },
    {
      name: "hidden",
      type: "checkbox",
      defaultValue: false,
      label: "Hide from the storefront",
      admin: {
        description:
          "Keeps the category and anything in it, but removes it from the shop grid, the header menu and the sitemap. Use for a department you are not selling yet, or one you have retired. Visibility is set here rather than inferred from whether the category happens to be empty — an empty department is often deliberate, and guessing gets it wrong in both directions.",
      },
    },
  ],
  hooks: {
    // Refuse before anything is removed — a category is not deletable while
    // products or sub-categories still point at it. See hooks/category-guards.
    beforeDelete: [categoryBeforeDelete],
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange, syncChatbotAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete, syncChatbotAfterDelete],
  },
};
