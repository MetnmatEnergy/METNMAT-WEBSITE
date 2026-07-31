import type { Access, CollectionConfig, Where } from "payload";
import { canManageCatalog, fieldAccountsOrInternal } from "../access";
import { slugify } from "../lib/blog";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { syncChatbotAfterChange, syncChatbotAfterDelete } from "../hooks/sync-chatbot";

/**
 * Public reads see PUBLISHED products only.
 *
 * `versions.drafts` is on, so without this gate a `read: publicRead` (literally
 * `() => true`) returned drafts to anonymous callers — a product still being
 * written would appear in the live shop, the search index and the sitemap the
 * moment someone hit Save. Mirrors the gate Projects and Posts already use.
 *
 * Staff (the `users` collection) bypass it so the admin list and Preview keep
 * showing drafts. Customers are a DIFFERENT auth collection and are correctly
 * treated as public here.
 */
const publishedRead: Access = ({ req: { user } }) => {
  if ((user as { collection?: string } | null)?.collection === "users") return true;
  const gate: Where = { _status: { equals: "published" } };
  return gate;
};

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    group: "Catalog",
    useAsTitle: "name",
    defaultColumns: ["name", "category", "sku", "price", "inStock", "featured"],
    // "Preview" button → the live storefront page for this product.
    preview: (doc) =>
      doc?.slug
        ? `${(process.env.WEBSITE_URL || "https://www.metnmat.com").replace(/\/+$/, "")}/shop/p/${doc.slug}`
        : null,
  },
  access: {
    read: publishedRead,
    create: canManageCatalog,
    update: canManageCatalog,
    delete: canManageCatalog,
  },
  versions: { drafts: true },
  fields: [
    // Authoring is grouped into tabs so a catalogue entry is a short, ordered
    // task list instead of one long scroll. These are UNNAMED tabs — purely a
    // UI grouping, so the stored document shape is unchanged (no migration).
    {
      type: "tabs",
      tabs: [
        {
          label: "Essentials",
          description:
            "What the product is. Name + Category + one Image is the minimum to publish.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "name",
                  type: "text",
                  required: true,
                  admin: {
                    width: "60%",
                    description:
                      "Full product name as customers should see it. Used as the page title and in search.",
                  },
                },
                {
                  name: "brand",
                  type: "text",
                  admin: {
                    width: "40%",
                    description: "Manufacturer / brand. Use 'METNMAT' for own-make items.",
                  },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "slug",
                  type: "text",
                  required: true,
                  unique: true,
                  index: true,
                  admin: {
                    width: "50%",
                    description:
                      "URL segment (auto-generated from the product name when blank), e.g. 'aluminum-sheet'. Changing it changes the product's public URL.",
                  },
                  // Auto-fill from the name so a product can never be saved without a
                  // slug. This mirrors Projects/Posts, and matters beyond convenience:
                  // the storefront addresses products by slug, and seed's
                  // cleanupMalformed() DELETES slug-less products on boot.
                  hooks: {
                    beforeValidate: [
                      ({ value, data }) =>
                        slugify((value as string) || (data?.name as string) || ""),
                    ],
                  },
                },
                {
                  name: "sku",
                  type: "text",
                  admin: {
                    width: "50%",
                    description:
                      "Your internal product code. Shown on the product page and on invoices.",
                  },
                },
              ],
            },
            {
              name: "category",
              type: "relationship",
              relationTo: "categories",
              required: true,
              admin: {
                description:
                  "Pick the most specific sub-category (e.g. 'Reference Electrodes', not 'Electrodes'). The product still appears on the parent department's page, so specific is always better.",
              },
            },
            {
              name: "shortDesc",
              type: "text",
              label: "Short description",
              admin: {
                description:
                  "One clear sentence (roughly 120–160 characters). This is the blurb on product cards, the search result snippet, and the page's SEO meta description — so write it for a customer, not as keywords.",
              },
            },
            {
              name: "description",
              type: "richText",
              admin: {
                description:
                  "Full description shown on the product page. Cover what it is, what it's used for, and anything a buyer must know.",
              },
            },
          ],
        },
        {
          label: "Media",
          description:
            "Photos and video. The first image is the thumbnail used across the whole site.",
          fields: [
            {
              name: "images",
              type: "array",
              labels: { singular: "Image", plural: "Images" },
              admin: {
                description:
                  "The FIRST image is the thumbnail used everywhere (shop grid, homepage showcase, search, cart). Add more for the product-page gallery. Use a clean, well-lit shot on a plain background; square or 4:3 crops render best.",
              },
              fields: [{ name: "image", type: "upload", relationTo: "media", required: true }],
            },
            {
              name: "videoUrl",
              type: "text",
              label: "YouTube video URL",
              admin: {
                placeholder: "https://youtu.be/B3EID6WKMNU",
                description:
                  "Optional. Paste a YouTube link (youtu.be/… or youtube.com/watch?v=…). It appears as a playable video in the product image gallery on the website.",
              },
              validate: (val: string | string[] | null | undefined) => {
                if (!val || typeof val !== "string" || !val.trim()) return true; // optional
                const ok =
                  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/.test(
                    val.trim()
                  );
                return (
                  ok ||
                  "Enter a valid YouTube link (e.g. https://youtu.be/… or https://www.youtube.com/watch?v=…)."
                );
              },
            },
          ],
        },
        {
          label: "Pricing",
          description:
            "Leave Price at 0 for quote-only items — the storefront then hides the price and shows an enquiry CTA instead of Add to cart.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "price",
                  type: "number",
                  min: 0,
                  admin: {
                    width: "33%",
                    description: "Base unit price in ₹ (excl. GST). 0 = quote-only.",
                  },
                },
                {
                  name: "usdPrice",
                  type: "number",
                  min: 0,
                  label: "USD price ($)",
                  admin: {
                    width: "33%",
                    placeholder: "Auto",
                    description:
                      "Optional. The final, tax-inclusive price international customers see, in USD (shown exactly as entered). Leave blank to auto-convert from ₹ at the latest exchange rate.",
                  },
                },
                { name: "unit", type: "text", defaultValue: "unit", admin: { width: "34%" } },
              ],
            },
            {
              name: "usdPriceHint",
              type: "ui",
              admin: { components: { Field: "/admin/UsdPriceHint" } },
            },
            {
              type: "row",
              fields: [
                {
                  name: "mrp",
                  type: "number",
                  min: 0,
                  admin: { width: "33%", description: "List price (₹) for discount display." },
                },
                {
                  name: "moq",
                  type: "number",
                  defaultValue: 1,
                  admin: { width: "33%", description: "Minimum order quantity." },
                },
                {
                  name: "leadTime",
                  type: "text",
                  admin: { width: "34%", description: "e.g. 'Ships in 1–2 weeks'." },
                },
              ],
            },
            {
              name: "priceTiers",
              type: "array",
              labels: { singular: "Tier", plural: "Bulk price tiers" },
              fields: [
                { name: "minQty", type: "number", required: true },
                { name: "price", type: "number", required: true },
              ],
            },
          ],
        },
        {
          label: "Specs & documents",
          description:
            "Technical detail. Specs appear as a table on the product page and as machine-readable data for search engines.",
          fields: [
            {
              name: "sizes",
              type: "array",
              labels: { singular: "Size", plural: "Available sizes" },
              admin: {
                description:
                  "Selectable size options for this SKU (shown as a picker on the product page).",
              },
              fields: [{ name: "label", type: "text", required: true }],
            },
            {
              name: "specs",
              type: "array",
              labels: { singular: "Spec", plural: "Specifications" },
              admin: {
                description:
                  "Label/value pairs, e.g. 'Purity' → '99.99%'. The first 6 show as 'Key specifications' beside the gallery; the rest go in the Specifications tab on the page.",
              },
              fields: [
                { name: "label", type: "text", required: true },
                { name: "value", type: "text", required: true },
              ],
            },
            {
              name: "documents",
              type: "relationship",
              relationTo: "documents",
              hasMany: true,
              admin: {
                description:
                  "Datasheets, SDS or certificates. Upload them in the Documents collection first, then link them here.",
              },
            },
          ],
        },
        {
          label: "Storefront",
          description: "How this product is merchandised on the site.",
          fields: [
            {
              type: "row",
              fields: [
                {
                  name: "inStock",
                  type: "checkbox",
                  defaultValue: true,
                  admin: {
                    width: "33%",
                    description:
                      "Storefront availability — this is the flag the website's In-stock/Made-to-order label reads. Independent of the on-hand quantity in 'Tax, stock & fulfilment'.",
                  },
                },
                {
                  name: "featured",
                  type: "checkbox",
                  defaultValue: false,
                  admin: {
                    width: "33%",
                    description:
                      "Feature this product on the homepage hero showcase, the homepage preview row, and 'Featured products' on the Shop page. Tick ~8 products — the hero showcase only animates when featured products exist.",
                  },
                },
                {
                  name: "rating",
                  type: "number",
                  min: 0,
                  max: 5,
                  admin: {
                    width: "34%",
                    description:
                      "Leave blank unless you hold real, verifiable customer feedback for this product — any value above 0 shows public star ratings on product cards. Inventing ratings is misleading advertising and is regulated in the markets we ship to.",
                  },
                },
              ],
            },
            {
              name: "badges",
              type: "select",
              hasMany: true,
              options: ["Bestseller", "New", "GST invoice", "Made by METNMAT"],
              admin: {
                description:
                  "Small tags on the product page. Only apply ones that are actually true.",
              },
            },
          ],
        },
      ],
    },

    // ── Tax & compliance (invoicing) ─────────────────────────────────────────
    {
      type: "collapsible",
      label: "Tax, stock & fulfilment",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "gstRate",
              type: "number",
              defaultValue: 18,
              min: 0,
              max: 28,
              admin: {
                width: "33%",
                readOnly: true,
                description:
                  "GST %. Currently applied SITE-WIDE at 18% — checkout does not yet honour per-product rates, so this field is locked to avoid promising what billing doesn't deliver.",
              },
            },
            { name: "hsnSac", type: "text", label: "HSN / SAC code", admin: { width: "33%" } },
            {
              name: "countryOfOrigin",
              type: "text",
              defaultValue: "India",
              admin: { width: "34%" },
            },
          ],
        },
        {
          name: "productType",
          type: "select",
          defaultValue: "in-stock",
          admin: {
            description:
              "Controls the storefront CTA. In stock / Made to order = buyable (Add to cart). Quote only / Discontinued = enquiry-only: no Buy button, no price shown, no purchase Offer in SEO data.",
          },
          options: [
            { label: "In stock", value: "in-stock" },
            { label: "Made to order", value: "made-to-order" },
            { label: "Quote only", value: "quote-only" },
            { label: "Discontinued", value: "discontinued" },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "stockQty",
              type: "number",
              min: 0,
              admin: {
                width: "33%",
                description:
                  "On-hand quantity (internal/informational — does NOT itself hide the Buy button; use the In-stock toggle above for that).",
              },
            },
            {
              name: "reservedStock",
              type: "number",
              min: 0,
              defaultValue: 0,
              admin: { width: "33%" },
            },
            {
              name: "lowStockThreshold",
              type: "number",
              min: 0,
              defaultValue: 5,
              admin: { width: "34%" },
            },
          ],
        },
        {
          type: "row",
          fields: [
            {
              name: "packageWeightKg",
              type: "number",
              min: 0,
              admin: { width: "50%", description: "Package weight (kg)." },
            },
            {
              name: "priceApprovalStatus",
              type: "select",
              defaultValue: "approved",
              access: { update: fieldAccountsOrInternal },
              admin: { width: "50%", description: "Commercial sign-off on the price." },
              options: [
                { label: "Approved", value: "approved" },
                { label: "Pending review", value: "pending" },
              ],
            },
          ],
        },
        {
          name: "lastReviewedAt",
          type: "date",
          admin: { description: "When the listing/price was last reviewed." },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange, syncChatbotAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete, syncChatbotAfterDelete],
  },
};
