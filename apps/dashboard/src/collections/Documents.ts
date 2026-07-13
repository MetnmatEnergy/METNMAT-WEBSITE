import type { CollectionConfig } from "payload";
import { canManageAssets, internalOrIsStaff } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Document assets. PRIVATE BY DEFAULT: quotation PDFs (Quotations/Enquiries),
 * invoice PDFs (Invoices) and task evidence upload into this collection, and
 * those carry customer names, addresses, GSTINs and pricing — with public read
 * anyone holding a URL could download them (audit finding, 2026-07-13). Staff
 * and the website server (internal key) can always read; anonymous visitors can
 * only fetch documents explicitly flagged `public` (brochures/datasheets meant
 * for the site). Nothing public consumes Documents today (product datasheets
 * render from a hardcoded empty list; the seeded blog posts carry no
 * attachments), so private-by-default breaks no live surface. The one future
 * surface to remember: blog post `attachments` render as public download links
 * — tick `public` on a doc before attaching it to an article.
 */
export const Documents: CollectionConfig = {
  slug: "documents",
  admin: { group: "Site & Mobile App", useAsTitle: "title", description: "PDFs & documents. Private unless flagged public." },
  access: {
    read: (args) => {
      if (internalOrIsStaff(args) === true) return true;
      return { public: { equals: true } };
    },
    create: canManageAssets,
    update: canManageAssets,
    delete: canManageAssets,
  },
  upload: {
    staticDir: "documents",
    mimeTypes: ["application/pdf"],
  },
  fields: [
    { name: "title", type: "text", required: true },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "datasheet",
      options: [
        { label: "Brochure", value: "brochure" },
        { label: "Technical Datasheet", value: "datasheet" },
        { label: "Certificate", value: "certificate" },
        { label: "Safety Data Sheet (SDS)", value: "sds" },
        { label: "Other", value: "other" },
      ],
    },
    {
      name: "public",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          "Allow anonymous download from the public website. Leave OFF for quotations, invoices and anything with customer data.",
      },
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
