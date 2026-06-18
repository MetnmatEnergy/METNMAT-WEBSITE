import type { CollectionConfig } from "payload";
import { canManageCatalog, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
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
      admin: { description: "URL segment, e.g. 'crucibles'." },
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
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange, syncChatbotAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete, syncChatbotAfterDelete],
  },
};
