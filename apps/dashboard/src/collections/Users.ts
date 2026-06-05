import type { CollectionConfig } from "payload";
import { isAdmin, isSuperAdmin, fieldSuperAdmin } from "../access";

export const Users: CollectionConfig = {
  slug: "users",
  auth: true,
  admin: {
    useAsTitle: "email",
    group: "Administration",
    defaultColumns: ["name", "email", "roles"],
  },
  access: {
    // Only admins can list/create users; anyone logged-in can read themselves.
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isSuperAdmin,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["sales"],
      // Only a super-admin may change roles (privilege escalation guard).
      access: { create: fieldSuperAdmin, update: fieldSuperAdmin },
      options: [
        { label: "Super Admin", value: "super-admin" },
        { label: "Admin", value: "admin" },
        { label: "Marketing", value: "marketing" },
        { label: "Sales", value: "sales" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        // The very first user to register becomes the Super Admin.
        if (operation === "create") {
          const { totalDocs } = await req.payload.count({ collection: "users" });
          if (totalDocs === 0) data.roles = ["super-admin"];
        }
        return data;
      },
    ],
  },
};
