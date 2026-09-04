import type { Access, CollectionConfig, Where } from "payload";
import { canManageCatalog, fieldAccountsOrInternal } from "../access";
import { slugify, validateHttpUrl } from "../lib/blog";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { syncChatbotAfterChange, syncChatbotAfterDelete } from "../hooks/sync-chatbot";
import { stockMovementHandler } from "../endpoints/stock";
import { stockFieldsBeforeChange, recordOpeningStock } from "../hooks/stock-guard";
import { inboundKeyMatches } from "../lib/internal-key";
import { productPreviewUrl } from "../lib/preview-link";
import { productBeforeDelete } from "../hooks/product-guards";

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
const xKey = (args: { req?: { headers?: unknown } }) =>
  (args.req?.headers as Headers | undefined)?.get?.("x-internal-key");

const publishedRead: Access = (args) => {
  if ((args.req.user as { collection?: string } | null)?.collection === "users") return true;
  // The website SERVER rendering a draft preview (Preview button ->
  // /api/shop/preview -> draft-mode fetch) presents the purpose-scoped internal
  // key. A browser never holds it — it lives only in the two server processes —
  // so this widens nothing a public request can reach. Exactly the bypass Posts
  // already carries, which is what makes the blog's draft preview work.
  if (inboundKeyMatches(xKey(args), "CMS_PREVIEW_KEY")) return true;
  const gate: Where = { _status: { equals: "published" } };
  return gate;
};

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    group: "Catalog",
    useAsTitle: "name",
    description:
      "A new product saves as a DRAFT and is not on the website until you press Publish. The Status column below is the check.",
    // `_status` sits immediately after the title, not buried mid-row, because
    // this column exists to be the first thing the eye lands on. `versions.drafts`
    // is on (below) and Payload injects `_status` with defaultValue "draft", so a
    // Save that never reached Publish produced a row indistinguishable from the
    // 131 live products — the "I added it and it never appeared" report. Payload
    // renders three states here, not two: the third, "changed", is a PUBLISHED
    // product carrying newer unpublished edits, which is the same complaint in
    // its subtler form ("I edited it and the site still shows the old text").
    defaultColumns: ["name", "_status", "category", "sku", "price", "inStock", "featured"],
    // The list search box. Left unset, Payload searches `useAsTitle` ALONE, so a
    // staff member holding a SKU — the code on the PO, the invoice and the shelf
    // label — got an empty list for a product that plainly exists.
    //
    // Naming fields here REPLACES that single condition with an OR across all of
    // them (payload/dist/utilities/mergeListSearchAndWhere.js), which is why
    // "name" must stay in this list: drop it and plain name search breaks.
    //
    // Identifiers only, deliberately. Adding shortDesc/description would turn
    // every marketing sentence into a hit and bury the exact-code lookup this
    // exists for.
    //
    // Admin-only: `listSearchableFields` is read solely by
    // `mergeListSearchAndWhere`, called from the List view and the bulk
    // edit/delete drawers. It is on no REST path, so storefront querying and the
    // `publishedRead` gate are unchanged.
    //
    // ONE key, not two. This line is the merge of two independently designed
    // patches that each added their own `listSearchableFields`; together they
    // were a duplicate property. If you are re-deriving one of them, edit this
    // line rather than adding a second.
    listSearchableFields: ["name", "sku", "brand"],
    // "Preview" button → the storefront THROUGH the website's draft-preview
    // route, so an unpublished product (the only kind anyone needs to preview)
    // renders instead of 404ing on the published-only public gate above.
    // Falls back to the plain public URL when no shared secret is configured.
    // See lib/preview-link.ts.
    preview: (doc) =>
      doc?.slug
        ? productPreviewUrl({
            slug: String(doc.slug),
            websiteUrl: process.env.WEBSITE_URL || "https://www.metnmat.com",
            secret: process.env.CMS_PREVIEW_KEY || process.env.INTERNAL_API_KEY,
          })
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
              name: "internationalPricing",
              type: "select",
              defaultValue: "AUTO_CONVERT",
              label: "International pricing",
              options: [
                { label: "Automatic ₹ → $ conversion", value: "AUTO_CONVERT" },
                { label: "Fixed international $ price", value: "FIXED_USD" },
              ],
              admin: {
                description:
                  "Automatic conversion uses the current ₹/$ exchange rate, so the international price follows the rupee price. Fixed lets you set a specific international selling price that never moves with the rate.",
              },
            },
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
                    // Hidden in automatic mode so there is no second price box
                    // whose emptiness silently means something.
                    condition: (data) => data?.internationalPricing === "FIXED_USD",
                    description:
                      "The final, tax-inclusive price international customers pay, in USD, shown exactly as entered.",
                  },
                  // Mode and value have to agree. A FIXED_USD product with no
                  // figure would silently fall back to conversion, which is the
                  // failure this whole field exists to remove.
                  validate: (value: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => {
                    const mode = siblingData?.internationalPricing;
                    const n = typeof value === "number" ? value : Number(value);
                    const present = value !== null && value !== undefined && String(value) !== "" && !Number.isNaN(n);
                    if (mode === "FIXED_USD") {
                      if (!present || n <= 0) return "Set a USD price above 0, or switch to automatic conversion.";
                    } else if (present && n > 0) {
                      return "Automatic conversion is selected, so this must be empty. Switch to fixed international pricing to set it.";
                    }
                    return true;
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

        {
          label: "SEO",
          description:
            "Everything here is optional — leave a field blank and the product's own name, short description and first image are used.",
          fields: [
            {
              name: "seoTitle",
              type: "text",
              admin: { description: "Overrides the page <title> (defaults to the product name, plus the brand)." },
            },
            {
              name: "metaDescription",
              type: "textarea",
              admin: { description: "Defaults to the short description. Around 150-160 characters reads best in search results." },
            },
            {
              name: "keywords",
              type: "text",
              admin: { description: "Comma-separated. Only terms genuinely relevant to this product." },
            },
            {
              name: "canonicalUrl",
              type: "text",
              validate: validateHttpUrl,
              admin: { description: "Only when this product canonically lives on another URL. Leave blank otherwise." },
            },
            {
              name: "ogImage",
              type: "upload",
              relationTo: "media",
              admin: { description: "Social sharing image (defaults to the first product image)." },
            },
            {
              name: "noIndex",
              type: "checkbox",
              defaultValue: false,
              admin: { description: "Ask search engines not to index this product. It stays reachable on the site." },
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
              /*
               * Editable while creating the product, locked once it exists.
               *
               * `admin.readOnly: true` was unconditional, which contradicted this
               * field's own description and broke the opening balance: a brand
               * new product could never be given a starting count, so
               * `recordOpeningStock` — the create hook that exists precisely to
               * write that first ledger row — could not fire from the admin at
               * all. Every product began at zero and its ledger began at the
               * first adjustment, which is the reconciliation gap the ledger was
               * added to close.
               *
               * Field access is operation-scoped, so it expresses the rule that
               * `readOnly` cannot. Verified in the installed packages:
               * getFieldPermissions() resolves `operation` against 'create' or
               * 'update' (payload/dist/utilities/getFieldPermissions.js), and
               * RenderFields forces `isReadOnly = true` when that permission is
               * absent (@payloadcms/ui .../RenderFields/index.js:66). So the
               * field renders editable on a new product and read-only forever
               * after, with no custom component.
               *
               * This is not the security boundary. Field access is skipped
               * entirely under `overrideAccess: true`, which the seed and the
               * importer both use, so the value stays pinned server-side in
               * hooks/stock-guard.ts. That hook is what actually stops a REST
               * caller moving stock behind the ledger's back; this makes the
               * form tell the truth about it.
               */
              access: { update: () => false },
              admin: {
                width: "33%",
                description:
                  "On-hand quantity. Set the opening balance here while creating the product — after that it is moved only with Adjust stock below, which records who changed it and why. Does NOT itself hide the Buy button — use the In-stock toggle above for that.",
              },
            },
            {
              name: "reservedStock",
              type: "number",
              min: 0,
              defaultValue: 0,
              // No opening value, ever: reserved stock is a claim made by an
              // order, so a number typed here would describe a reservation that
              // does not exist. Locked on create as well as update — unlike
              // stockQty, which has a legitimate opening balance. On update
              // hooks/stock-guard.ts pins it too; on create, field access is the
              // whole guard, which is sufficient because the only callers that
              // skip it (seed, importer) do not set the field.
              access: { create: () => false, update: () => false },
              admin: {
                width: "33%",
                readOnly: true,
                description:
                  "Held against orders. Moved by the order lifecycle and by Reserve / Release below — never typed in.",
              },
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
          // Typing a new number into stockQty above writes no ledger row, no
          // reason and no author, and can silently overwrite a concurrent
          // change. This panel is the authorized path: it goes through the same
          // server-side service the order hooks use.
          name: "stockAdjust",
          type: "ui",
          admin: { components: { Field: "/admin/StockAdjust" } },
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
  endpoints: [
    /**
     * POST /api/products/stock-movement
     * The authorized way to change stock. Authorization mirrors
     * canManageInventory exactly and is enforced server-side.
     */
    { path: "/stock-movement", method: "post", handler: stockMovementHandler },
  ],
  hooks: {
    // Derive internationalPricing for rows written before the field existed.
    //
    // Mode used to be IMPLIED by whether usdPrice was set. Existing products
    // therefore have no value here, and the field default only applies on
    // create — so without this, opening a product that carries a usdPrice and
    // pressing save would fail validation (automatic conversion is selected,
    // so this must be empty) on data that was perfectly valid a moment before.
    //
    // Reading the mode back out of the old shape keeps every existing product
    // behaving exactly as it does today, with no data migration and no price
    // movement. seed.ts persists the same derivation once; this covers the
    // window before that runs, and any row it misses.
    beforeValidate: [
      ({ data }) => {
        if (!data) return data;
        if (data.internationalPricing) return data;
        const usd = Number(data.usdPrice);
        data.internationalPricing = Number.isFinite(usd) && usd > 0 ? "FIXED_USD" : "AUTO_CONVERT";
        return data;
      },
    ],
    // Refuse before anything is removed — a product is not deletable while the
    // stock ledger or a live order still points at it. See hooks/product-guards.
    beforeDelete: [productBeforeDelete],
    // Stock only moves through lib/stock. A document save may not change it.
    beforeChange: [stockFieldsBeforeChange],
    afterChange: [recordOpeningStock, auditAfterChange, revalidateWebsiteAfterChange, syncChatbotAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete, syncChatbotAfterDelete],
  },
};
