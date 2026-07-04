import type { CollectionConfig } from "payload";
import { canManageInventory, isStaff, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

/**
 * Dispatch / shipment records for orders. Managed by Inventory + Operations.
 */
export const Shipments: CollectionConfig = {
  slug: "shipments",
  admin: {
    group: "Sales",
    useAsTitle: "trackingNumber",
    defaultColumns: ["order", "carrier", "trackingNumber", "status", "dispatchedAt"],
    description: "Dispatch & tracking for orders.",
  },
  access: {
    read: isStaff,
    create: canManageInventory,
    update: canManageInventory,
    delete: isAdmin,
  },
  fields: [
    { name: "order", type: "relationship", relationTo: "orders", required: true },
    {
      type: "row",
      fields: [
        {
          name: "status",
          type: "select",
          defaultValue: "pending",
          admin: { width: "50%" },
          options: [
            { label: "Pending dispatch", value: "pending" },
            { label: "Dispatched", value: "dispatched" },
            { label: "In transit", value: "in-transit" },
            { label: "Delivered", value: "delivered" },
            { label: "Returned", value: "returned" },
          ],
        },
        { name: "carrier", type: "text", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "trackingNumber", type: "text", index: true, admin: { width: "50%" } },
        { name: "trackingUrl", type: "text", admin: { width: "50%" } },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "dispatchedAt", type: "date", admin: { width: "50%" } },
        { name: "deliveredAt", type: "date", admin: { width: "50%" } },
      ],
    },
    {
      name: "items",
      type: "array",
      labels: { singular: "Item", plural: "Items" },
      fields: [
        { name: "productName", type: "text", required: true },
        { name: "qty", type: "number", required: true },
      ],
    },
    { name: "notes", type: "textarea" },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
