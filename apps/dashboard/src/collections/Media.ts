import type { CollectionConfig } from "payload";
import { canManageAssets, canUploadMedia, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { enforceProductImageSpec } from "../hooks/product-image-spec";
import { generateDisplayDerivative, writeDisplayDerivativeLocally } from "../hooks/product-display-derivative";
import { mediaBeforeDelete } from "../hooks/media-guards";

/**
 * Media library — all IMAGE assets (product, catalog, hero/marketing banners,
 * logo, favicon, user uploads). Generates responsive variants automatically.
 */
export const Media: CollectionConfig = {
  slug: "media",
  admin: { group: "Site & Mobile App", useAsTitle: "filename", description: "Images & banners." },
  access: {
    read: publicRead,
    // Anyone who may author a product may add its imagery; changing or deleting
    // what is already in the library stays with the asset managers. See
    // canUploadMedia for why the two were split.
    create: canUploadMedia,
    /*
     * UPDATE is widened with create, and DELETE deliberately is not.
     *
     * `category` is required, has no default, is chosen from eight options, and
     * is load-bearing rather than filing: "product" is what enforces the
     * resolution floor and generates the subject-aware gallery crop. Pick the
     * wrong one and the photo uploads unprocessed — and with update refused the
     * uploader had no way back, because delete is refused too. Their only move
     * was to upload the file again, creating a second row they also could not
     * remove. Being allowed to start a task and not finish it is worse than not
     * being allowed to start.
     *
     * Delete stays narrow because mediaBeforeDelete already refuses anything a
     * product or page still displays, so widening it would add nothing except
     * power over someone else's unreferenced orphans.
     */
    update: canUploadMedia,
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
      // The gallery/card surface. Payload generates this as a plain contain
      // render; for product photographs the display-derivative hook then
      // REPLACES the buffer with a subject-aware composition (see
      // hooks/product-display-derivative.ts), so this config doubles as the
      // graceful fallback whenever analysis declines. withoutEnlargement:false
      // forces generation even when the source is smaller than 1600×1200 —
      // otherwise Payload skips the size entirely and the hook has no slot.
      { name: "display", width: 1600, height: 1200, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: false, formatOptions: { format: "webp", options: { quality: 88 } } },
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
      // No defaultValue, deliberately. Payload fills a field default in the
      // FIELD-level beforeValidate pass, which runs BEFORE this collection's
      // beforeValidate hooks (payload/dist/collections/operations/create.js and
      // .../utilities/update.js both order "beforeValidate - Fields" then
      // "- Collections"). A default of "product" therefore arrived at
      // enforceProductImageSpec indistinguishable from a staff choice, and that
      // hook's "was it explicitly set?" guard was dead code. Fifteen of the
      // seventeen upload fields pointing at this collection are NOT product
      // photography — the site logo and favicon, Clients.logo, Team.photo, the
      // Posts and Projects cover images, Categories.image — so the default was
      // wrong far more often than right: a banner uploaded from any of those
      // drawers was measured against the product resolution floor and
      // re-composed by the display pipeline. Staff pick instead, and `required`
      // turns an omission into an inline field error rather than a silent
      // mis-filing. The pick is reachable everywhere it is now needed: the
      // document drawer and the bulk-upload drawer both render the full
      // collection form, and bulk upload's Apply changes sets one value across
      // every queued file. Do not restore the ergonomics with
      // defaultValue: "other" either — that would silently skip the resolution
      // floor and the subject-aware crop on real product photographs, which is
      // a quieter failure than the one being fixed here.
      admin: {
        description:
          "Load-bearing, not just filing: the Product Image category enforces the product resolution floor (shortest side at least 900px) and generates the subject-aware gallery crop. Pick it only for product photography — banners, logos, team photos and article figures each have their own category.",
      },
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
    // Resolution floor for product photographs (product category only —
    // banners, logos and user uploads are unaffected).
    beforeValidate: [enforceProductImageSpec],
    // Subject-aware `display` derivative (exact 4:3, 1600×1200) so the gallery
    // fills its frame while the stored original stays untouched for the
    // lightbox. Injected via req.payloadUploadSizes + data.sizes, which the
    // storage plugin persists like any configured size.
    beforeChange: [generateDisplayDerivative],
    // Refuse before anything is removed — a file is not deletable while a
    // product, page or settings screen still displays it. Runs ahead of
    // deleteAssociatedFiles, so the S3 object survives the refusal too.
    // See hooks/media-guards.
    beforeDelete: [mediaBeforeDelete],
    afterChange: [writeDisplayDerivativeLocally, auditAfterChange, revalidateWebsiteAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete],
  },
};
