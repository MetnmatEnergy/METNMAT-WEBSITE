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

// ── Composable custom roles (permission areas) ────────────────────────────────
// Super-admins/admins design roles in the "Staff Roles" collection by ticking
// permission AREAS, then assign them to users (users.customRoles). Every access
// helper below honours both the fixed legacy roles AND these areas — so a
// custom "Content + Assets" role works everywhere canManageContent /
// canManageAssets is enforced. Custom roles can NEVER grant admin powers:
// user management, role design/assignment, PINs and deletions stay with the
// fixed super-admin/admin roles.
export const PERMISSION_AREAS = [
  { label: "Sales — leads, enquiries, quotations, orders, tickets", value: "sales" },
  { label: "Support — support tickets & return requests", value: "support" },
  { label: "Operations — shipments, stock, order fulfilment, approvals", value: "operations" },
  { label: "Accounts & Finance — payments, invoices, commercial approvals", value: "accounts" },
  { label: "Catalog — products & shop categories", value: "catalog" },
  { label: "Website Content — blog, services, projects, FAQs, team, clients", value: "content" },
  { label: "Assets — images (Media) & documents", value: "assets" },
  { label: "Website Settings — branding, homepage, navigation, maintenance, SEO", value: "settings" },
  { label: "Administration — read-only staff list, audit & integration logs", value: "administration" },
] as const;
export type PermissionArea = (typeof PERMISSION_AREAS)[number]["value"];

type CustomRoleRef = { isActive?: boolean; areas?: string[] } | string | null;

/**
 * True when any of the user's ACTIVE custom roles grants one of the areas.
 * Relies on users.auth.depth = 1 populating `customRoles` into req.user;
 * unpopulated bare ids grant nothing (fail-closed).
 */
export const hasArea = (user: unknown, ...areas: PermissionArea[]): boolean => {
  const list = (user as { customRoles?: CustomRoleRef[] } | null | undefined)?.customRoles;
  if (!Array.isArray(list)) return false;
  const wanted = areas as readonly string[];
  return list.some(
    (r) =>
      r !== null &&
      typeof r === "object" &&
      r.isActive !== false &&
      Array.isArray(r.areas) &&
      r.areas.some((a) => wanted.includes(a)),
  );
};

/** Fixed roles OR custom-role areas — the one check hooks/endpoints should use. */
export const hasRoleOrArea = (
  user: unknown,
  roles: Role[],
  areas: PermissionArea[],
): boolean => hasRole(user as UserLike, ...roles) || hasArea(user, ...areas);

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

/**
 * Logged-in STAFF only. `req.user` can also be a storefront CUSTOMER (the
 * customers auth collection has public self-registration), so internal
 * collections must check the auth collection — a bare `!!user` would let any
 * shopper with an account read staff data.
 */
export const isStaff: Access = ({ req: { user } }) =>
  !!user && (user as { collection?: string }).collection === "users";

/**
 * Staff, or the website server via the shared internal key. Used where the
 * storefront needs a server-side read-back of operational data it shows to the
 * verified owner (e.g. an order's shipment tracking on the account page).
 */
export const internalOrIsStaff: Access = (args) => {
  if (safeKeyEqual(xKey(args), process.env.INTERNAL_API_KEY)) return true;
  return isStaff(args);
};

export const isSuperAdmin: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");

export const isAdmin: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin");

/** Admin + operations leadership (or an Operations-area custom role). */
export const isAdminOrOps: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager") ||
  hasArea(user, "operations");

/** Website content (blog, services, projects, …): fixed content roles or a Content-area custom role. */
export const canManageContent: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing") || hasArea(user, "content");

// The historical canManageCatalog helper gated BOTH the product catalog and the
// sales pipeline. The fixed-role membership is preserved verbatim on every
// split below (zero change for existing users) — custom-role areas are what
// differ per split, so a designed role can be "catalog only" or "sales only".
const legacyCatalogRoles = (user: unknown): boolean =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "marketing", "sales");

/** Products + shop categories. */
export const canManageCatalog: Access = ({ req: { user } }) =>
  legacyCatalogRoles(user) || hasArea(user, "catalog");

/** Sales pipeline: leads, enquiries, quotations, customer comms. */
export const canManageSales: Access = ({ req: { user } }) =>
  legacyCatalogRoles(user) || hasArea(user, "sales");

/** Orders: sales owns them, operations fulfils them. Marketing deliberately
 * excluded (least-privilege — orders carry customer PII and payment state;
 * audit finding 2026-07-13). */
export const canManageOrders: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "sales") ||
  hasArea(user, "sales", "operations");

/** Tickets: support owns them, sales sees customer context. */
export const canManageTickets: Access = ({ req: { user } }) =>
  legacyCatalogRoles(user) || hasArea(user, "support", "sales");

/** Media & documents: content roles or an Assets/Content-area custom role
 * (content editors need to upload the images their pages use). */
export const canManageAssets: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing") ||
  hasArea(user, "assets", "content");

/** Website settings (globals): fixed content roles or a Settings-area custom role. */
export const canManageSettings: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "marketing") || hasArea(user, "settings");

/** Payments / invoices / commercial approval. */
export const canManageAccounts: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "accounts") || hasArea(user, "accounts");

/** Stock & dispatch. */
export const canManageInventory: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "inventory") ||
  hasArea(user, "operations");

/** Support tickets & returns. */
export const canManageSupport: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "operations-manager", "support") ||
  hasArea(user, "support");

/** Read operational data: any logged-in staff (incl. read-only auditor) — never customers. */
export const canReadOps: Access = ({ req: { user } }) =>
  !!user && (user as { collection?: string }).collection === "users";

/** Audit logs: admins, the read-only auditor, or an Administration-area custom role. */
export const canReadAudit: Access = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin", "read-only-auditor") ||
  hasArea(user, "administration");

/**
 * Staff directory read: admins or an Administration-area custom role see all
 * users (PINs stay super-admin-only at field level). Every other staff member
 * can read ONLY their own account — Payload's /me (which the admin panel needs
 * to load a session) does a findByID with access control, so without this a
 * non-admin could authenticate but never use the panel.
 */
export const canReadStaff: Access = ({ req: { user } }) => {
  if (hasRole(user as UserLike, "super-admin", "admin") || hasArea(user, "administration")) return true;
  const u = user as { id?: string | number; collection?: string } | null;
  if (u?.id && u.collection === "users") return { id: { equals: u.id } };
  return false;
};

/** Public read (the website fetches published content anonymously). */
export const publicRead: Access = () => true;

/**
 * Staff can read; the website server can also read by presenting the shared
 * `x-internal-key` header (used to attach customer files to the confirmation
 * email). Customer files stay private from the public web.
 */
export const internalOrCanManageCatalog: Access = (args) => {
  if (safeKeyEqual(xKey(args), process.env.INTERNAL_API_KEY)) return true;
  return canManageSales(args);
};

/** Orders + payment events: website server (CMS_ORDER_WRITE_KEY, else shared) or staff. */
export const internalOrderOrManage: Access = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_ORDER_WRITE_KEY")) return true;
  return canManageOrders(args);
};

/** Tickets: website server (CMS_TICKET_WRITE_KEY, else shared) or staff. */
export const internalTicketOrManage: Access = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_TICKET_WRITE_KEY")) return true;
  return canManageTickets(args);
};

// ── Field-level access ────────────────────────────────────────────────────────
export const fieldSuperAdmin: FieldAccess = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin");

/** Super-admin or admin — used for assigning custom roles to users. */
export const fieldAdmin: FieldAccess = ({ req: { user } }) =>
  hasRole(user as UserLike, "super-admin", "admin");

/**
 * Payment / commercial fields (order amounts, Razorpay ids, paidAt): writable
 * only by accounts/admin/super-admin (or an Accounts-area custom role), OR the
 * website server presenting the internal key (it records the verified payment).
 * NOT sales/marketing/ops — so a non-finance staffer cannot alter what was
 * charged or the payment record.
 */
export const fieldAccountsOrInternal: FieldAccess = (args) => {
  if (inboundKeyMatches(xKey(args), "CMS_ORDER_WRITE_KEY")) return true;
  return (
    hasRole(args.req.user as UserLike, "super-admin", "admin", "accounts") ||
    hasArea(args.req.user, "accounts")
  );
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
