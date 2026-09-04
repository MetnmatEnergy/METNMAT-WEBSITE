import type { CollectionConfig } from "payload";
import { canManageCatalog, publicRead } from "../access";
import { slugify } from "../lib/blog";
import { categoryOrderDefault } from "../lib/category-order";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { categoryBeforeDelete } from "../hooks/category-guards";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
// A category rename changes products' subcategory label (and can shift the bot's
// 5-value enum bucket), so a category edit must also resync the chatbot catalog.
import { syncChatbotAfterChange, syncChatbotAfterDelete } from "../hooks/sync-chatbot";

export const Categories: CollectionConfig = {
  slug: "categories",
  admin: {
    group: "Catalog",
    useAsTitle: "name",
    // The number that decides the shop menu is shown, and the list is sorted by
    // it — so "why is this department first?" is answerable from the list view
    // rather than by opening every row in turn.
    defaultColumns: ["name", "order", "parent", "slug"],
  },
  // Top-level, NOT under `admin` — Payload 3.85 declares defaultSort on the
  // collection config itself (collections/config/types.d.ts:490); putting it in
  // `admin` is a type error, which is how this was caught.
  defaultSort: "order",
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
    {
      name: "order",
      type: "number",
      // Required so the field can never end up empty. A cleared number saves as
      // null, and MongoDB sorts null ahead of every number — the same silent
      // jump to the front of the menu that the default used to cause. 0 still
      // validates (payload's number validation short-circuits on isNumber), so
      // the categories already sitting at 0 stay saveable.
      required: true,
      defaultValue: categoryOrderDefault,
      admin: {
        description:
          "Position in the shop menu and the department grid — lowest number first. A new category is pre-filled with the next number after the last one, so it lands at the END of the menu; change it only to deliberately move a department. The number is global: it orders the top-level departments, and orders sub-categories within their parent.",
      },
    },
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
