import type { CollectionConfig } from "payload";
import { isAdmin, isStaff, PERMISSION_AREAS } from "../access";
import { auditAfterChange, auditAfterDelete } from "../hooks/audit";

/**
 * The role designer. Super-admins/admins compose custom roles by ticking
 * permission AREAS (Sales, Support, Operations, Accounts, Catalog, Website
 * Content, Assets, Website Settings, Administration), then assign them to
 * staff on the user record (Users → Custom roles). A user's effective powers
 * are the UNION of their fixed role(s) and all their active custom roles.
 *
 * Safety rails — custom roles can NEVER grant:
 *  - user management (create/edit users), role design or role assignment
 *  - PIN visibility, hard deletes reserved for admins/super-admins
 * Those remain exclusive to the fixed Super Admin / Admin roles.
 */
export const StaffRoles: CollectionConfig = {
  slug: "staff-roles",
  labels: { singular: "Staff Role", plural: "Staff Roles" },
  admin: {
    group: "Administration",
    useAsTitle: "name",
    defaultColumns: ["name", "areas", "isActive", "updatedAt"],
    description:
      "Design custom roles by combining permission areas, then assign them to employees on their user record (Users → Custom roles). Powers add up: fixed role + custom roles. Admin powers (user management, role design, PINs) can never be granted here.",
  },
  access: {
    read: isStaff, // staff can see what a role means; only admins can change it
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "e.g. 'Store Manager', 'Content Editor', 'Sales + Support'." },
    },
    {
      name: "description",
      type: "textarea",
      admin: { description: "What this role is for — shown to admins when assigning it." },
    },
    {
      name: "areas",
      type: "select",
      hasMany: true,
      required: true,
      options: PERMISSION_AREAS.map((a) => ({ label: a.label, value: a.value })),
      admin: {
        description:
          "Tick every area this role may manage. A user with this role gets ALL ticked areas (in addition to anything their fixed role already allows).",
      },
    },
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      admin: {
        description:
          "Untick to suspend this role everywhere at once — every user holding it immediately loses its permissions (their fixed role is unaffected).",
      },
    },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
};
