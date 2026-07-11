import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * FAQ entries shown on the homepage FAQ section (also emitted as FAQ schema
 * for SEO/answer engines). Marketing+ can manage.
 */
export const Faqs: CollectionConfig = {
  slug: "faqs",
  labels: { singular: "FAQ", plural: "FAQs" },
  admin: {
    group: "Site & Mobile App",
    useAsTitle: "question",
    defaultColumns: ["question", "category", "order", "active"],
    description: "Frequently asked questions shown on the website.",
  },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  fields: [
    { name: "question", type: "text", required: true },
    { name: "answer", type: "textarea", required: true, admin: { description: "Keep it concise and factual — also used for SEO answer snippets." } },
    {
      type: "row",
      fields: [
        { name: "category", type: "text", admin: { width: "50%", description: "Optional grouping, e.g. 'Products'." } },
        { name: "order", type: "number", defaultValue: 0, admin: { width: "25%", description: "Sort order." } },
        { name: "active", type: "checkbox", defaultValue: true, admin: { width: "25%", description: "Uncheck to hide." } },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
