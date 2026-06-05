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

/** Products + catalog: super-admin, admin, marketing, sales. */
export const canManageCatalog: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing", "sales");

/** Public read (the website fetches published content anonymously). */
export const publicRead: Access = () => true;

// ── Field-level access ────────────────────────────────────────────────────────
export const fieldSuperAdmin: FieldAccess = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");
