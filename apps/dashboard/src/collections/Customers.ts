import type { CollectionConfig } from "payload";
import { isAdmin } from "../access";

/**
 * Website customer accounts (storefront login) — a SEPARATE auth collection from
 * staff `users`. Customers register/login via the website, which talks to these
 * REST endpoints. They can read & edit only their own record; staff see all.
 * Guest checkout still works (orders just won't link to a customer).
 */
export const Customers: CollectionConfig = {
  slug: "customers",
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
    maxLoginAttempts: 8,
    lockTime: 10 * 60 * 1000,
    forgotPassword: {
      generateEmailSubject: () => "Reset your METNMAT password",
      generateEmailHTML: (args) => {
        const token = (args as { token?: string } | undefined)?.token ?? "";
        const base = process.env.WEBSITE_URL || "http://localhost:3000";
        const url = `${base}/reset?token=${token}`;
        return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;color:#111">
          <h2 style="margin:0 0 12px">Reset your password</h2>
          <p style="color:#444;line-height:1.5">We received a request to reset the password for your METNMAT account. Click the button below to choose a new one. This link expires in 1 hour.</p>
          <p style="margin:22px 0"><a href="${url}" style="background:#d81f26;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">Reset password</a></p>
          <p style="color:#888;font-size:13px;line-height:1.5">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${url}</span></p>
          <p style="color:#888;font-size:13px;margin-top:18px">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </div>`;
      },
    },
  },
  admin: {
    group: "Sales",
    useAsTitle: "email",
    defaultColumns: ["name", "email", "phone", "company", "createdAt"],
    description: "Storefront customer accounts. Created when shoppers register on the website.",
  },
  access: {
    create: () => true, // public registration from the website
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (user.collection === "users") return true; // staff see all
      return { id: { equals: user.id } }; // customers see only themselves
    },
    update: ({ req: { user } }) => {
      if (!user) return false;
      if (user.collection === "users") return true;
      return { id: { equals: user.id } };
    },
    delete: isAdmin,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      type: "row",
      fields: [
        { name: "phone", type: "text", admin: { width: "50%" } },
        { name: "company", type: "text", admin: { width: "50%" } },
      ],
    },
    { name: "gstin", type: "text", label: "GSTIN" },
    {
      name: "addresses",
      type: "array",
      labels: { singular: "Address", plural: "Addresses" },
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", type: "text", admin: { width: "60%", placeholder: "e.g. Office, Warehouse" } },
            { name: "isDefault", type: "checkbox", label: "Default", admin: { width: "40%" } },
          ],
        },
        { name: "line1", type: "text", label: "Address line 1" },
        { name: "line2", type: "text", label: "Address line 2" },
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
  ],
};
