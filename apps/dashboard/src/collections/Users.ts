import { randomBytes } from "crypto";
import type { CollectionConfig } from "payload";
import {
  isAdmin,
  isSuperAdmin,
  fieldSuperAdmin,
  fieldAdmin,
  fieldRolesCreate,
  bootstrapAllowed,
  canReadStaff,
  hasRole,
  ROLE_OPTIONS,
} from "../access";
import { derivePassword, PIN_REGEX } from "../lib/pin";

export const Users: CollectionConfig = {
  slug: "users",
  // depth 1 populates `customRoles` (with their permission areas) into req.user
  // on every request, which is what lets ALL access checks and workflow gates
  // honour custom roles synchronously. Email + password remain under the hood
  // (break-glass recovery).
  auth: { depth: 1 },
  admin: {
    useAsTitle: "name",
    group: "Administration",
    defaultColumns: ["name", "roles", "customRoles", "pin", "email"],
    description:
      "Staff accounts. Give each employee a unique 4-digit PIN — that's how they sign in. Powers = fixed role + any assigned custom roles (designed under Staff Roles). Email & password are kept only for break-glass recovery.",
  },
  access: {
    read: canReadStaff, // admins + Administration-area custom roles (read-only staff directory)
    create: isAdmin,
    update: isAdmin,
    delete: isSuperAdmin,
  },
  fields: [
    { name: "name", type: "text", required: true },
    {
      // Shadow the auth email field to gate its READ: it is a login identifier
      // (and legacy synthetic addresses embedded the PIN), so only admins and
      // the account owner may see it — an Administration-area staff directory
      // shows names/roles, not credentials.
      name: "email",
      type: "email",
      required: true,
      unique: true,
      access: {
        read: ({ req: { user }, doc }) =>
          hasRole(user as Parameters<typeof hasRole>[0], "super-admin", "admin") ||
          (!!user && user.collection === "users" && String(user.id) === String(doc?.id)),
      },
    },
    {
      name: "pin",
      type: "text",
      label: "4-digit login PIN",
      maxLength: 4,
      index: true,
      admin: {
        placeholder: "e.g. 4821",
        description:
          "The employee signs in with this 4-digit key. Must be unique. Leave blank for an email/password recovery-only account.",
      },
      // Only a super-admin can see or set PINs (they're a login credential).
      access: { read: fieldSuperAdmin, create: fieldSuperAdmin, update: fieldSuperAdmin },
    },
    {
      name: "roles",
      type: "select",
      hasMany: true,
      required: true,
      defaultValue: ["sales"],
      access: { create: fieldRolesCreate, update: fieldSuperAdmin },
      options: ROLE_OPTIONS,
      admin: {
        description:
          "Fixed base role(s). For finer control, combine with custom roles below.",
      },
    },
    {
      name: "customRoles",
      type: "relationship",
      relationTo: "staff-roles",
      hasMany: true,
      // Super-admin AND admin may assign custom roles (they can only ever grant
      // the areas designed in Staff Roles — never admin powers).
      access: { create: fieldAdmin, update: fieldAdmin },
      admin: {
        description:
          "Custom roles designed under Administration → Staff Roles. The user's powers are their fixed role PLUS every area these roles grant.",
      },
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ req, operation, data, originalDoc }) => {
        if (!data) return data;

        // Normalise: an empty PIN means "no PIN" (recovery-only account).
        if (data.pin === "" || data.pin === null) {
          data.pin = undefined;
        }

        if (data.pin != null) {
          const pin = String(data.pin);
          if (!PIN_REGEX.test(pin)) {
            throw new Error("PIN must be exactly 4 digits (0–9).");
          }
          // Enforce uniqueness ourselves (avoids unique-index collisions on the
          // many recovery accounts that legitimately have no PIN).
          const clash = await req.payload.find({
            collection: "users",
            where: {
              and: [
                { pin: { equals: pin } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          if (clash.totalDocs > 0) {
            throw new Error("That PIN is already in use — choose a different 4-digit PIN.");
          }

          // Staff don't need a real mailbox; auto-fill a synthetic, unique email
          // so the account can exist without anyone typing an address. MUST be
          // opaque — never derived from the PIN (the email is visible to user-
          // list readers, the PIN is a login credential).
          if (operation === "create" && !data.email) {
            data.email = `staff-${randomBytes(6).toString("hex")}@staff.metnmat.local`;
          }
        }

        return data;
      },
    ],
    beforeChange: [
      async ({ req, operation, data }) => {
        // Keep the real password in lockstep with the PIN so /pin-login can
        // authenticate through Payload's own login() machinery.
        if (data?.pin != null && data.pin !== "") {
          data.password = derivePassword(String(data.pin));
        }
        // The very first user to register becomes the Super Admin — but ONLY when
        // bootstrap is allowed (dev, or ALLOW_FIRST_USER_BOOTSTRAP=true in prod).
        // Otherwise an empty users collection must not mint a super-admin to an
        // anonymous visitor. (ensureSuperAdmin in seed.ts still recovers a
        // lost-role lockout because it promotes an existing user, never creates one.)
        if (operation === "create" && bootstrapAllowed()) {
          const { totalDocs } = await req.payload.count({ collection: "users" });
          if (totalDocs === 0) data.roles = ["super-admin"];
        }
        return data;
      },
    ],
  },
};
