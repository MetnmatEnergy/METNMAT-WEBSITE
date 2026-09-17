import type { CollectionBeforeChangeHook } from "payload";
import { hasRole } from "../access";
import { staffError } from "../lib/staff-error";

/**
 * Only a super-admin may touch a super-admin, and only a super-admin (or the
 * account's own owner) may change a staff account's sign-in credentials.
 *
 * THE HOLE (2026-09-17 audit). `users.update` is open to admins, which is right
 * for day-to-day staff management, but Payload's auth `password` and `email`
 * fields have no field-level access. An admin could therefore
 * `PATCH /api/users/<super-admin> {"password": "x"}`, log in as the super-admin
 * with the built-in email/password strategy, and give themselves every role.
 * The same access let an admin re-point the super-admin's email and hijack the
 * forgot-password flow.
 *
 * The PIN path is unaffected: `pin` is already super-admin-only at field level,
 * and syncPinPassword derives the password from it before this hook runs.
 */
type StaffUser = { id?: string | number; collection?: string; roles?: string[] } | null | undefined;

export const protectPrivilegedStaff: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (!data || operation !== "update" || !originalDoc) return data;
  const actor = req?.user as StaffUser;
  if (!actor || actor.collection !== "users") return data; // Local API / system paths
  if (hasRole(actor as Parameters<typeof hasRole>[0], "super-admin")) return data;

  const targetIsSuperAdmin = Array.isArray(originalDoc.roles) && originalDoc.roles.includes("super-admin");
  if (targetIsSuperAdmin) {
    throw staffError("Only a super-admin can edit a super-admin account.");
  }

  const self = String(originalDoc.id ?? "") === String(actor.id ?? "");
  const d = data as Record<string, unknown>;
  const changesPassword = typeof d.password === "string" && d.password.length > 0;
  const nextEmail = typeof d.email === "string" ? d.email.trim().toLowerCase() : "";
  const prevEmail = typeof originalDoc.email === "string" ? String(originalDoc.email).trim().toLowerCase() : "";
  const changesEmail = Boolean(nextEmail) && nextEmail !== prevEmail;
  if (!self && (changesPassword || changesEmail)) {
    throw staffError("Only a super-admin can change another staff member's email or password.");
  }
  return data;
};
