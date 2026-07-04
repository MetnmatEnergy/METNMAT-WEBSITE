import type { CollectionConfig } from "payload";
import { isStaff, internalOrCanManageCatalog, isAdmin } from "../access";

/**
 * In-app notifications for staff (assignment, status changes, system alerts).
 * Written by hooks/the server; staff can mark them read.
 */
export const Notifications: CollectionConfig = {
  slug: "notifications",
  admin: {
    group: "Administration",
    useAsTitle: "title",
    defaultColumns: ["title", "type", "recipient", "read", "createdAt"],
    description: "Staff notifications.",
  },
  access: {
    read: isStaff,
    create: internalOrCanManageCatalog, // system/hooks create; staff can too
    update: isStaff, // mark as read
    delete: isAdmin,
  },
  fields: [
    {
      type: "row",
      fields: [
        { name: "title", type: "text", required: true, admin: { width: "70%" } },
        { name: "type", type: "text", admin: { width: "30%", description: "e.g. assignment, alert." } },
      ],
    },
    { name: "message", type: "textarea" },
    { name: "recipient", type: "relationship", relationTo: "users" },
    { name: "read", type: "checkbox", defaultValue: false },
    {
      type: "row",
      fields: [
        { name: "relatedCollection", type: "text", admin: { width: "50%" } },
        { name: "relatedId", type: "text", admin: { width: "50%" } },
      ],
    },
  ],
  timestamps: true,
};
