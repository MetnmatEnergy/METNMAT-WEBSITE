import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/** Document assets: brochures, technical datasheets, certificates, SDS. */
export const Documents: CollectionConfig = {
  slug: "documents",
  admin: { group: "Assets", useAsTitle: "title", description: "PDFs & documents." },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
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
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
