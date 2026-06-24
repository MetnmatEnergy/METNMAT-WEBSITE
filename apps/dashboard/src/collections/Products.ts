import type { CollectionConfig } from "payload";
import { canManageCatalog, publicRead, fieldAccountsOrInternal } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { revalidateWebsiteAfterChange, revalidateWebsiteAfterDelete } from "../hooks/revalidate";
import { syncChatbotAfterChange, syncChatbotAfterDelete } from "../hooks/sync-chatbot";

export const Products: CollectionConfig = {
  slug: "products",
  admin: {
    group: "Catalog",
    useAsTitle: "name",
    defaultColumns: ["name", "brand", "category", "price", "inStock"],
  },
  access: {
    read: publicRead,
    create: canManageCatalog,
    update: canManageCatalog,
    delete: canManageCatalog,
  },
  versions: { drafts: true },
  fields: [
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true, admin: { width: "60%" } },
        { name: "brand", type: "text", admin: { width: "40%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "slug", type: "text", required: true, unique: true, index: true, admin: { width: "50%" } },
        { name: "sku", type: "text", admin: { width: "50%" } },
      ],
    },
    { name: "category", type: "relationship", relationTo: "categories", required: true },
    { name: "shortDesc", type: "text" },
    { name: "description", type: "richText" },
    {
      name: "images",
      type: "array",
      labels: { singular: "Image", plural: "Images" },
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
        return ok || "Enter a valid YouTube link (e.g. https://youtu.be/… or https://www.youtube.com/watch?v=…).";
      },
    },
    {
      type: "row",
      fields: [
        { name: "price", type: "number", min: 0, admin: { width: "33%", description: "Base unit price in ₹ (excl. GST). 0 = quote-only." } },
        {
          name: "usdPrice",
          type: "number",
          min: 0,
          label: "USD price ($)",
          admin: {
            width: "33%",
            placeholder: "Auto",
            description: "Optional. The final, tax-inclusive price international customers see, in USD (shown exactly as entered). Leave blank to auto-convert from ₹ at the latest exchange rate.",
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
        { name: "mrp", type: "number", min: 0, admin: { width: "33%", description: "List price (₹) for discount display." } },
        { name: "moq", type: "number", defaultValue: 1, admin: { width: "33%", description: "Minimum order quantity." } },
        { name: "leadTime", type: "text", admin: { width: "34%", description: "e.g. 'Ships in 1–2 weeks'." } },
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
    {
      name: "sizes",
      type: "array",
      labels: { singular: "Size", plural: "Available sizes" },
      admin: { description: "Selectable size options for this SKU (shown as a picker on the product page)." },
      fields: [{ name: "label", type: "text", required: true }],
    },
    {
      name: "specs",
      type: "array",
      labels: { singular: "Spec", plural: "Specifications" },
      fields: [
        { name: "label", type: "text", required: true },
        { name: "value", type: "text", required: true },
      ],
    },
    { name: "documents", type: "relationship", relationTo: "documents", hasMany: true },
    {
      type: "row",
      fields: [
        { name: "inStock", type: "checkbox", defaultValue: true, admin: { width: "33%" } },
        { name: "featured", type: "checkbox", defaultValue: false, admin: { width: "33%" } },
        { name: "rating", type: "number", min: 0, max: 5, admin: { width: "34%" } },
      ],
    },
    { name: "badges", type: "select", hasMany: true, options: ["Bestseller", "New", "GST invoice", "Made by METNMAT"] },

    // ── Tax & compliance (invoicing) ─────────────────────────────────────────
    {
      type: "collapsible",
      label: "Tax, stock & fulfilment",
      admin: { initCollapsed: true },
      fields: [
        {
          type: "row",
          fields: [
            { name: "gstRate", type: "number", defaultValue: 18, min: 0, max: 28, admin: { width: "33%", description: "GST %." } },
            { name: "hsnSac", type: "text", label: "HSN / SAC code", admin: { width: "33%" } },
            { name: "countryOfOrigin", type: "text", defaultValue: "India", admin: { width: "34%" } },
          ],
        },
        {
          name: "productType",
          type: "select",
          defaultValue: "in-stock",
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
            { name: "stockQty", type: "number", min: 0, admin: { width: "33%", description: "On-hand quantity." } },
            { name: "reservedStock", type: "number", min: 0, defaultValue: 0, admin: { width: "33%" } },
            { name: "lowStockThreshold", type: "number", min: 0, defaultValue: 5, admin: { width: "34%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "packageWeightKg", type: "number", min: 0, admin: { width: "50%", description: "Package weight (kg)." } },
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
        { name: "lastReviewedAt", type: "date", admin: { description: "When the listing/price was last reviewed." } },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateWebsiteAfterChange, syncChatbotAfterChange],
    afterDelete: [auditAfterDelete, revalidateWebsiteAfterDelete, syncChatbotAfterDelete],
  },
};
