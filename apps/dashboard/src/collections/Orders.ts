import type { CollectionConfig } from "payload";
import { canManageCatalog, internalOrCanManageCatalog, isAdmin } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

/**
 * Customer orders (Razorpay checkout). Created by the WEBSITE SERVER only
 * (via the shared x-internal-key header — never by the public), then managed
 * by staff: payment status updates automatically, fulfilment is manual.
 */
export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Order", plural: "Orders" },
  admin: {
    group: "Sales",
    useAsTitle: "orderNumber",
    defaultColumns: ["orderNumber", "name", "status", "total", "createdAt"],
    description: "Paid & pending orders from the website checkout.",
  },
  access: {
    create: internalOrCanManageCatalog, // website server (x-internal-key) or staff
    read: internalOrCanManageCatalog, // website server needs read-back for verification
    update: internalOrCanManageCatalog, // website server marks paid; staff manage fulfilment
    delete: isAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "orderNumber", type: "text", required: true, unique: true, index: true, admin: { width: "50%" } },
        {
          name: "status",
          type: "select",
          required: true,
          defaultValue: "pending",
          admin: { width: "50%" },
          options: [
            { label: "Pending payment", value: "pending" },
            { label: "Paid", value: "paid" },
            { label: "Payment failed", value: "failed" },
            { label: "Shipped", value: "shipped" },
            { label: "Delivered", value: "delivered" },
            { label: "Cancelled", value: "cancelled" },
            { label: "Refunded", value: "refunded" },
          ],
        },
      ],
    },

    // Customer
    {
      type: "row",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "email", type: "email", required: true },
      ],
    },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text" },
        { name: "company", type: "text" },
      ],
    },

    // Shipping address
    {
      type: "collapsible",
      label: "Shipping address",
      fields: [
        { name: "addressLine1", type: "text" },
        { name: "addressLine2", type: "text" },
        {
          type: "row",
          fields: [
            { name: "city", type: "text", admin: { width: "33%" } },
            { name: "state", type: "text", admin: { width: "33%" } },
            { name: "pincode", type: "text", admin: { width: "34%" } },
          ],
        },
        { name: "country", type: "text", defaultValue: "India" },
      ],
    },

    // GST (optional, B2B)
    {
      type: "row",
      fields: [
        { name: "gstin", type: "text", label: "GSTIN", admin: { width: "50%" } },
        { name: "businessName", type: "text", admin: { width: "50%" } },
      ],
    },

    // Items (price snapshot at purchase time, GST-inclusive)
    {
      name: "items",
      type: "array",
      labels: { singular: "Item", plural: "Items" },
      fields: [
        { name: "productName", type: "text", required: true },
        {
          type: "row",
          fields: [
            { name: "slug", type: "text", admin: { width: "40%" } },
            { name: "sku", type: "text", admin: { width: "30%" } },
            { name: "qty", type: "number", required: true, admin: { width: "30%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "unitPrice", type: "number", required: true, admin: { width: "50%", description: "Per unit, incl. GST (₹)." } },
            { name: "lineTotal", type: "number", required: true, admin: { width: "50%", description: "Incl. GST (₹)." } },
          ],
        },
      ],
    },

    // Amounts (INR, GST-inclusive)
    {
      type: "row",
      fields: [
        { name: "subtotal", type: "number", required: true, admin: { width: "33%", description: "Incl. GST (₹)." } },
        { name: "gstAmount", type: "number", admin: { width: "33%", description: "GST contained (₹)." } },
        { name: "total", type: "number", required: true, admin: { width: "34%", description: "Charged amount (₹)." } },
      ],
    },

    // Payment (Razorpay)
    {
      type: "collapsible",
      label: "Payment (Razorpay)",
      fields: [
        { name: "razorpayOrderId", type: "text", index: true, admin: { readOnly: true } },
        { name: "razorpayPaymentId", type: "text", admin: { readOnly: true } },
        { name: "paidAt", type: "date", admin: { readOnly: true } },
      ],
    },

    // What the customer saw (international orders are charged in INR but
    // browsed in USD — capture the context for support/invoicing).
    {
      type: "row",
      fields: [
        {
          name: "displayCurrency",
          type: "select",
          defaultValue: "INR",
          options: ["INR", "USD"],
          admin: { width: "33%", description: "Currency the customer browsed in." },
        },
        { name: "usdRateAtPurchase", type: "number", admin: { width: "33%", readOnly: true, description: "₹ per $1 at purchase." } },
        { name: "totalUsdApprox", type: "number", admin: { width: "34%", readOnly: true, description: "≈ total in USD (display)." } },
      ],
    },

    {
      name: "customer",
      type: "relationship",
      relationTo: "customers",
      admin: {
        position: "sidebar",
        description: "Linked storefront account, if the buyer was logged in. Guest orders have none.",
      },
    },

    { name: "notes", type: "textarea", admin: { description: "Internal notes (not shown to the customer)." } },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
