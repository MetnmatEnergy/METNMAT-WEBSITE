import type { CollectionConfig } from "payload";
import { canManageSales, internalOrCanManageCatalog, isAdmin } from "../access";

/**
 * Customer-uploaded files (PDF / image / camera photo) attached to a quote or
 * customization request. Public CREATE — the website's quote form uploads here
 * (same trust model as Enquiries). Only staff can read & manage them.
 *
 * Linked from each enquiry via the Enquiries `attachments` field.
 */
export const EnquiryUploads: CollectionConfig = {
  slug: "enquiry-uploads",
  admin: {
    group: "Sales",
    useAsTitle: "filename",
    description: "Files customers attached to quote / customization requests.",
    defaultColumns: ["filename", "source", "createdAt"],
  },
  access: {
    create: () => true, // public website form uploads here
    read: internalOrCanManageCatalog, // staff, or website server via x-internal-key
    update: canManageSales,
    delete: isAdmin,
  },
  upload: {
    staticDir: "enquiry-uploads",
    mimeTypes: [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/heic",
      "image/heif",
    ],
  },
  fields: [
    {
      name: "source",
      type: "text",
      admin: { position: "sidebar", readOnly: true, description: "Where it was submitted from." },
    },
  ],
  timestamps: true,
};
