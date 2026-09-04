import type { CollectionConfig } from "payload";
import { isStaff } from "../access";

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
    description:
      "Append-only record of every stock movement. Rows are written by the system when stock actually moves — to change stock, use the Stock panel on the product itself.",
  },
  access: {
    read: isStaff,
    /**
     * No hand-written rows. The ledger RECORDS movements that happened; it does
     * not cause them. `lib/stock.ts` is the only thing that moves stock, and it
     * writes its row with `overrideAccess: true`, so the service, the order
     * hooks and the opening-balance hook are all untouched by this.
     *
     * A row typed into the admin moved no stock at all, and — with update and
     * delete already false — could never be corrected or withdrawn. Worse, it
     * poisons the idempotency check in `hooks/order-stock.ts`, which asks the
     * ledger whether an order's stock has already been applied: a hand row
     * carrying a relatedOrder makes a real paid order skip its deduction.
     *
     * Staff adjust stock through the Stock panel on the product, which posts to
     * /api/products/stock-movement. That endpoint enforces the same
     * canManageInventory role set server-side (endpoints/stock.ts:37-45), so
     * WHO may move stock is unchanged — only the way they do it.
     */
    create: () => false,
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
