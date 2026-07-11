import type { CollectionConfig } from "payload";
import { internalOrderOrManage, isSuperAdmin, fieldAccountsOrInternal } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";
import { orderBeforeChange, orderBeforeDelete } from "../hooks/order-workflow";

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
    create: internalOrderOrManage, // website server (order-write key) or staff
    read: internalOrderOrManage, // website server needs read-back for verification
    update: internalOrderOrManage, // website server marks paid; staff manage fulfilment
    delete: isSuperAdmin, // paid/fulfilled orders are also blocked by orderBeforeDelete
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

    // Billing address (defaults to same as shipping; captured for the invoice).
    {
      type: "collapsible",
      label: "Billing address",
      admin: { initCollapsed: true },
      fields: [
        {
          name: "billingSameAsShipping",
          type: "checkbox",
          label: "Same as shipping address",
          defaultValue: true,
        },
        { name: "billingName", type: "text" },
        { name: "billingLine1", type: "text" },
        { name: "billingLine2", type: "text" },
        {
          type: "row",
          fields: [
            { name: "billingCity", type: "text", admin: { width: "33%" } },
            { name: "billingState", type: "text", admin: { width: "33%" } },
            { name: "billingPincode", type: "text", admin: { width: "34%" } },
          ],
        },
        { name: "billingCountry", type: "text", defaultValue: "India" },
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

    // Customer-provided delivery instructions (shown to fulfilment staff).
    {
      name: "deliveryNotes",
      type: "textarea",
      label: "Delivery instructions (from customer)",
      admin: { description: "Landmark / access / timing notes the customer gave at checkout." },
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
            { name: "slug", type: "text", admin: { width: "30%" } },
            { name: "sku", type: "text", admin: { width: "25%" } },
            { name: "size", type: "text", admin: { width: "20%", description: "Selected size variant." } },
            { name: "qty", type: "number", required: true, admin: { width: "25%" } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "unitPrice", type: "number", required: true, admin: { width: "50%", description: "Per unit, incl. GST (₹)." } },
            { name: "lineTotal", type: "number", required: true, admin: { width: "50%", description: "Incl. GST (₹)." } },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "hsnSac", type: "text", label: "HSN / SAC", admin: { width: "50%", description: "Snapshotted at purchase — printed on the GST invoice." } },
            { name: "countryOfOrigin", type: "text", admin: { width: "50%" } },
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
        { name: "razorpayOrderId", type: "text", index: true, access: { update: fieldAccountsOrInternal }, admin: { readOnly: true } },
        { name: "razorpayPaymentId", type: "text", access: { update: fieldAccountsOrInternal }, admin: { readOnly: true } },
        { name: "paidAt", type: "date", access: { update: fieldAccountsOrInternal }, admin: { readOnly: true } },
        { name: "emailedAt", type: "date", access: { update: fieldAccountsOrInternal }, admin: { readOnly: true, description: "When the confirmation email was sent (set automatically)." } },
      ],
    },

    // GST invoice identity — minted automatically the first time an order turns
    // paid (sequential per financial year via the atomic Counters pattern), then
    // immutable. Indexed, not unique: legacy paid orders predate the series.
    {
      type: "row",
      fields: [
        { name: "invoiceNumber", type: "text", index: true, admin: { width: "50%", readOnly: true, description: "Sequential GST invoice serial (INV-FFYY-000001), assigned on payment." } },
        { name: "invoiceDate", type: "date", admin: { width: "50%", readOnly: true } },
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

    {
      name: "marketingOptIn",
      type: "checkbox",
      label: "Marketing opt-in",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description: "Customer agreed to marketing emails at checkout.",
      },
    },

    { name: "notes", type: "textarea", admin: { description: "Internal notes (not shown to the customer)." } },
  ],
  hooks: {
    beforeChange: [orderBeforeChange],
    beforeDelete: [orderBeforeDelete],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
