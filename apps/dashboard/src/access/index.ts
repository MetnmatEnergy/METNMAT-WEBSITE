import type { Access, FieldAccess } from "payload";

/**
 * Role-based access control.
 * Roles (most → least privileged): super-admin, admin, marketing, sales.
 */
export type Role = "super-admin" | "admin" | "marketing" | "sales";

type UserLike = { roles?: Role[] } | null | undefined;

export const hasRole = (user: UserLike, ...roles: Role[]): boolean =>
  !!user && Array.isArray((user as { roles?: Role[] }).roles)
    ? (user as { roles: Role[] }).roles.some((r) => roles.includes(r))
    : false;

// ── Collection-level access ───────────────────────────────────────────────────
export const isLoggedIn: Access = ({ req: { user } }) => !!user;

export const isSuperAdmin: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");

export const isAdmin: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin");

/** Content + branding + media: super-admin, admin, marketing. */
export const canManageContent: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing");

/** Products + catalog + enquiries: super-admin, admin, marketing, sales. */
export const canManageCatalog: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing", "sales");

/** Public read (the website fetches published content anonymously). */
export const publicRead: Access = () => true;

/**
 * Staff can read; the website server can also read by presenting the shared
 * `x-internal-key` header (used to attach customer files to the confirmation
 * email). Customer files stay private from the public web.
 */
export const internalOrCanManageCatalog: Access = (args) => {
  const secret = process.env.INTERNAL_API_KEY;
  const provided = (args.req?.headers as Headers | undefined)?.get?.("x-internal-key");
  if (secret && provided && provided === secret) return true;
  return canManageCatalog(args);
};

// ── Field-level access ────────────────────────────────────────────────────────
export const fieldSuperAdmin: FieldAccess = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");

/**
 * The `roles` field is writable by a super-admin — PLUS, only during first-user
 * bootstrap (no user exists yet), by the unauthenticated create. Without that
 * bootstrap allowance the very first account is saved with its role STRIPPED
 * (there is no super-admin yet to satisfy the check), so nobody can do anything
 * and the admin shows "You are not allowed to perform this action."
 */
export const fieldRolesCreate: FieldAccess = ({ req: { user } }) =>
  !user || hasRole(user as UserLike, "super-admin");
