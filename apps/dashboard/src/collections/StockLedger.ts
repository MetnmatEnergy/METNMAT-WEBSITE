import type { CollectionConfig } from "payload";
import { canManageInventory, isStaff } from "../access";

/**
 * Append-only record of every stock movement. Inventory is never silently
 * overwritten — each change (in/out/reserved/released/adjustment/damaged/
 * returned) lands here with the before/after quantities, so stock is auditable.
 */
export const StockLedger: CollectionConfig = {
  slug: "stock-ledger",
  labels: { singular: "Stock Movement", plural: "Stock Ledger" },
  admin: {
    group: "Catalog",
    useAsTitle: "movementType",
    defaultColumns: ["product", "movementType", "quantity", "newQuantity", "createdAt"],
    description: "Append-only record of every stock movement.",
  },
  access: {
    read: isStaff,
    create: canManageInventory,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: "product", type: "relationship", relationTo: "products", required: true },
    {
      name: "movementType",
      type: "select",
      required: true,
      options: [
        { label: "Stock in", value: "stock-in" },
        { label: "Stock out", value: "stock-out" },
        { label: "Reserved", value: "reserved" },
        { label: "Released", value: "released" },
        { label: "Adjustment", value: "adjustment" },
        { label: "Damaged", value: "damaged" },
        { label: "Returned", value: "returned" },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "quantity", type: "number", required: true, admin: { width: "33%" } },
        { name: "previousQuantity", type: "number", admin: { width: "33%" } },
        { name: "newQuantity", type: "number", admin: { width: "34%" } },
      ],
    },
    { name: "relatedOrder", type: "relationship", relationTo: "orders" },
    { name: "relatedEnquiry", type: "relationship", relationTo: "enquiries" },
    { name: "reason", type: "text" },
    { name: "createdBy", type: "relationship", relationTo: "users" },
  ],
  timestamps: true,
};
