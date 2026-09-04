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
import { derivePassword, derivePinLookup, PIN_REGEX } from "../lib/pin";
import { syncPinPassword } from "../hooks/pin-credential";
import { staffError } from "../lib/staff-error";

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
      /*
       * WRITE-ONLY. Type a PIN here to SET one; the value is never stored and
       * never shown back. What persists is `pinLookup` below.
       *
       * It used to be an ordinary text field, so MongoDB held the four digits in
       * the clear, indexed, in the same document as the password hash. Field
       * access limited who could read it through Payload's API, but anyone able
       * to read the collection itself — a backup, an aggregation, a compromised
       * connection string — had every staff credential without needing the
       * pepper or breaking anything.
       *
       * The visible consequence: a super-admin can no longer look up a colleague's
       * forgotten PIN. They set a new one. That is the correct behaviour for a
       * credential and is the point of the change, not a side effect of it.
       */
      name: "pin",
      type: "text",
      label: "4-digit login PIN",
      maxLength: 4,
      virtual: true,
      admin: {
        placeholder: "Enter 4 digits to set a new PIN",
        description:
          "Write-only. Enter a 4-digit key to SET or CHANGE this person's PIN. Existing PINs are not stored and cannot be shown — if one is forgotten, set a new one. Leave blank to keep the current PIN, or clear it via Remove PIN.",
      },
      access: { read: () => false, create: fieldSuperAdmin, update: fieldSuperAdmin },
    },
    {
      /*
       * HMAC of the PIN under a label distinct from the password derivation, so
       * this value cannot serve as the password even though it is stored plainly.
       * Sign-in derives the same value from the submitted PIN and matches on
       * equality, which keeps the lookup indexed.
       */
      name: "pinLookup",
      type: "text",
      index: true,
      admin: { hidden: true, readOnly: true },
      access: { read: () => false, create: () => false, update: () => false },
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
    /*
     * MUST stay beforeOperation. Payload snapshots `data.password` at the top of
     * updateDocument() and decides there whether to hash it — 99 lines before
     * collection beforeChange hooks run — so a password assigned in beforeChange
     * is never read on update. Moving this into beforeChange would silently stop
     * PIN changes from taking effect, exactly as before. Full evidence, with
     * line numbers from the installed Payload, in hooks/pin-credential.ts.
     */
    beforeOperation: [syncPinPassword],
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
            throw staffError("PIN must be exactly 4 digits (0–9).");
          }
          // Enforce uniqueness ourselves (avoids unique-index collisions on the
          // many recovery accounts that legitimately have no PIN).
          // Compared on the derived value, because the PIN itself is no longer
          // stored to compare against. The derivation is deterministic, so two
          // people choosing the same PIN still collide here.
          const clash = await req.payload.find({
            collection: "users",
            where: {
              and: [
                { pinLookup: { equals: derivePinLookup(pin) } },
                ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          });
          if (clash.totalDocs > 0) {
            throw staffError("That PIN is already in use — choose a different 4-digit PIN.");
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
        /*
         * Record the lookup that sign-in matches on, and drop the PIN.
         *
         * `pin` is virtual, so it is not persisted — but it is deleted here as
         * well rather than relied upon, because this is the single place that
         * decides a credential is never written down.
         *
         * The password assignment below is what makes a CREATE work: create.js
         * reads the password after its hooks. It does NOT make an update work —
         * see the beforeOperation note above — which is why syncPinPassword
         * exists. Both derive the same deterministic value, so the two paths
         * cannot disagree.
         */
        if (data?.pin != null && data.pin !== "") {
          const pin = String(data.pin);
          data.password = derivePassword(pin);
          data.pinLookup = derivePinLookup(pin);
          delete data.pin;
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
