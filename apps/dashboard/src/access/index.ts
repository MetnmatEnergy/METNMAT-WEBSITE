import type { Access, FieldAccess } from "payload";
import { safeKeyEqual, inboundKeyMatches } from "../lib/internal-key";

const xKey = (args: { req?: { headers?: unknown } }) =>
  (args.req?.headers as Headers | undefined)?.get?.("x-internal-key");

/**
 * Role-based access control.
 * Roles (most → least privileged):
 *   super-admin       — full access
 *   admin             — daily operations, manage staff & workflows
 *   operations-manager— assign work, approve workflows, manage catalog/ops
 *   marketing         — website content + media
 *   sales             — leads, RFQs, quotation drafts, customer comms
 *   technical         — technical notes/files on assigned RFQs/tickets
 *   inventory         — stock & dispatch readiness
 *   accounts          — payments, invoices, refunds, commercial approval
 *   support           — support tickets & customer communication
 *   read-only-auditor — read-only access to operational data + audit logs
 */
export type Role =
  | "super-admin"
  | "admin"
  | "operations-manager"
  | "marketing"
  | "sales"
  | "technical"
  | "inventory"
  | "accounts"
  | "support"
  | "read-only-auditor";

/** Selectable role options for the Users collection (label/value pairs). */
export const ROLE_OPTIONS: { label: string; value: Role }[] = [
  { label: "Super Admin", value: "super-admin" },
  { label: "Admin", value: "admin" },
  { label: "Operations Manager", value: "operations-manager" },
  { label: "Marketing", value: "marketing" },
  { label: "Sales", value: "sales" },
  { label: "Technical", value: "technical" },
  { label: "Inventory", value: "inventory" },
  { label: "Accounts", value: "accounts" },
  { label: "Support", value: "support" },
  { label: "Read-only Auditor", value: "read-only-auditor" },
];

type UserLike = { roles?: Role[] } | null | undefined;

export const hasRole = (user: UserLike, ...roles: Role[]): boolean =>
  !!user && Array.isArray((user as { roles?: Role[] }).roles)
    ? (user as { roles: Role[] }).roles.some((r) => roles.includes(r))
    : false;

/**
 * First-user / super-admin bootstrap is only allowed when explicitly enabled
 * (or outside production). In production an empty users collection must NOT let
 * an anonymous visitor self-promote to super-admin — the operator sets
 * ALLOW_FIRST_USER_BOOTSTRAP=true for the one-time first-account creation, then
 * removes it. (The seed's ensureSuperAdmin still recovers from a lost-role
 * lockout because it only promotes an EXISTING user, never creates one.)
 */
export const bootstrapAllowed = (): boolean =>
  process.env.ALLOW_FIRST_USER_BOOTSTRAP === "true" || process.env.NODE_ENV !== "production";

// ── Collection-level access ───────────────────────────────────────────────────
export const isLoggedIn: Access = ({ req: { user } }) => !!user;

export const isSuperAdmin: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");

export const isAdmin: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin");

/** Admin + operations leadership. */
export const isAdminOrOps: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager");

/** Content + branding + media: super-admin, admin, marketing. */
export const canManageContent: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing");

/** Products + catalog + enquiries: super-admin, admin, ops, marketing, sales. */
export const canManageCatalog: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "marketing", "sales");

/** Payments / invoices / commercial approval: super-admin, admin, accounts. */
export const canManageAccounts: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "accounts");

/** Stock & dispatch: super-admin, admin, ops, inventory. */
export const canManageInventory: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "inventory");

/** Support tickets: super-admin, admin, ops, support. */
export const canManageSupport: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "support");

/** Read operational data: any logged-in staff (incl. read-only auditor). */
export const canReadOps: Access = ({ req: { user } }) => !!user;

/** Audit logs are readable by admins and the dedicated read-only auditor. */
export const canReadAudit: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "read-only-auditor");

/** Public read (the website fetches published content anonymously). */
export const publicRead: Access = () => true;

/**
 * Staff can read; the website server can also read by presenting the shared
 * `x-internal-key` header (used to attach customer files to the confirmation
 * email). Customer files stay private from the public web.
 */
export const internalOrCanManageCatalog: Access = (args) => {
  if (safeKeyEqual(xKey(args), process.env.INTERNAL_API_KEY)) return true;
  return canManageCatalog(args);
};

/** Orders + payment events: website server (CMS_ORDER_WRITE_KEY, else shared) or staff. */
export const internalOrderOrManage: Access = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_ORDER_WRITE_KEY")) return true;
  return canManageCatalog(args);
};

/** Tickets: website server (CMS_TICKET_WRITE_KEY, else shared) or staff. */
export const internalTicketOrManage: Access = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_TICKET_WRITE_KEY")) return true;
  return canManageCatalog(args);
};

// ── Field-level access ────────────────────────────────────────────────────────
export const fieldSuperAdmin: FieldAccess = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");

/**
 * Payment / commercial fields (order amounts, Razorpay ids, paidAt): writable
 * only by accounts/admin/super-admin, OR the website server presenting the
 * internal key (it records the verified payment). NOT sales/marketing/ops — so
 * a non-finance staffer cannot alter what was charged or the payment record.
 */
export const fieldAccountsOrInternal: FieldAccess = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_ORDER_WRITE_KEY")) return true;
  return hasRole(args.req.user as UserLike, "super-admin", "admin", "accounts");
};

/**
 * The `roles` field is writable by a super-admin — PLUS, only during first-user
 * bootstrap (no user yet AND bootstrap is explicitly allowed), by the
 * unauthenticated create. Without that allowance the very first account is saved
 * with its role STRIPPED and nobody can do anything; WITH it ungated, anyone
 * could self-promote on an empty collection (see bootstrapAllowed).
 */
export const fieldRolesCreate: FieldAccess = ({ req: { user } }) =>
  (!user && bootstrapAllowed()) || hasRole(user as UserLike, "super-admin");
