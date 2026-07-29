import type { CollectionConfig } from "payload";
import { canManageAssets, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { enforceProductImageSpec } from "../hooks/product-image-spec";

/**
 * Media library — all IMAGE assets (product, catalog, hero/marketing banners,
 * logo, favicon, user uploads). Generates responsive variants automatically.
 */
export const Media: CollectionConfig = {
  slug: "media",
  admin: { group: "Site & Mobile App", useAsTitle: "filename", description: "Images & banners." },
  access: {
    read: publicRead,
    create: canManageAssets,
    update: canManageAssets,
    delete: canManageAssets,
  },
  upload: {
    staticDir: "media",
    // No SVG: this collection is publicRead + public-served, and an SVG can carry
    // <script>/onload (stored XSS). Raster formats only; they're re-encoded by sharp.
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/avif"],
    adminThumbnail: "thumb",
    focalPoint: true,
    // 4:3 variant ladder matching the 2400×1800 product master. Every size uses
    // fit:"contain" on a TRANSPARENT canvas — never "cover" — so a photo is
    // letterboxed, never cropped, and the same file sits correctly on the light
    // and dark themes. The old ladder had a 300×300 1:1 "thumbnail" that cropped
    // to square, plus width-only entries that produced inconsistent heights.
    imageSizes: [
      { name: "micro", width: 192, height: 144, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, formatOptions: { format: "webp", options: { quality: 82 } } },
      { name: "thumb", width: 320, height: 240, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, formatOptions: { format: "webp", options: { quality: 82 } } },
      { name: "card", width: 800, height: 600, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, formatOptions: { format: "webp", options: { quality: 85 } } },
      { name: "pdp", width: 1600, height: 1200, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, formatOptions: { format: "webp", options: { quality: 88 } } },
      { name: "zoom", width: 2400, height: 1800, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, formatOptions: { format: "webp", options: { quality: 90 } } },
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
    // Enforce the 4:3 / ≥2400px product master spec at upload time (product
    // category only — banners, logos and user uploads are unaffected).
    beforeValidate: [enforceProductImageSpec],
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
