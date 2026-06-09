import type { CollectionConfig } from "payload";
import { canManageCatalog, publicRead } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

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
      type: "row",
      fields: [
        { name: "price", type: "number", admin: { width: "33%", description: "Base unit price (₹). 0 = quote-only." } },
        { name: "mrp", type: "number", admin: { width: "33%", description: "List price for discount display." } },
        { name: "unit", type: "text", defaultValue: "unit", admin: { width: "33%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "moq", type: "number", defaultValue: 1, admin: { width: "50%", description: "Minimum order quantity." } },
        { name: "leadTime", type: "text", admin: { width: "50%", description: "e.g. 'Ships in 1–2 weeks'." } },
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
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
};
