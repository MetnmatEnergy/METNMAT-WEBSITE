import type { CollectionConfig } from "payload";
import { canManageContent, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";

/**
 * Media library — all IMAGE assets (product, catalog, hero/marketing banners,
 * logo, favicon, user uploads). Generates responsive variants automatically.
 */
export const Media: CollectionConfig = {
  slug: "media",
  admin: { group: "Assets", useAsTitle: "filename", description: "Images & banners." },
  access: {
    read: publicRead,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  upload: {
    staticDir: "media",
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/avif", "image/svg+xml"],
    adminThumbnail: "thumbnail",
    focalPoint: true,
    imageSizes: [
      { name: "thumbnail", width: 300, height: 300, position: "centre" },
      { name: "card", width: 640 },
      { name: "tablet", width: 1024 },
      { name: "desktop", width: 1920 },
    ],
    formatOptions: { format: "webp", options: { quality: 80 } },
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      admin: { description: "Describe the image (accessibility + SEO)." },
    },
    {
      name: "category",
      type: "select",
      required: true,
      defaultValue: "product",
      admin: { description: "Used to organise the media library." },
      options: [
        { label: "Product Image", value: "product" },
        { label: "Catalog Image", value: "catalog" },
        { label: "Hero Banner", value: "hero-banner" },
        { label: "Marketing Banner", value: "marketing-banner" },
        { label: "Logo", value: "logo" },
        { label: "Favicon", value: "favicon" },
        { label: "User Upload", value: "user-upload" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "caption", type: "text" },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
