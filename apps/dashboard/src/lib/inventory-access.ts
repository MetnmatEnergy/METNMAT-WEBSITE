/**
 * Who may move stock — one membership, read by the server AND by the admin UI.
 *
 * WHAT WAS BROKEN. The Adjust-stock panel is a Payload `ui` field with
 * `admin.components.Field` and nothing else. A `ui` field holds no data, so it
 * cannot carry field `access`, and there was no `admin.condition` either — which
 * left the collection's READ permission as the only thing deciding whether the
 * panel rendered. The endpoint behind it accepts a strictly narrower set.
 *
 * So the panel appeared, live and interactive, for staff the server would
 * refuse: marketing, sales, technical, accounts, support and read-only-auditor,
 * plus every custom-role area except operations. `sales` is the default role for
 * a new staff account, so the mismatch was the default experience rather than an
 * edge case. The sharpest instance is the read-only auditor, whose whole form
 * Payload renders read-only EXCEPT a custom Field component — Payload passes it
 * no `readOnly` prop, so that one panel stayed fully usable.
 *
 * WHAT THIS DOES NOT DO. It grants nothing and removes nothing. The server check
 * is unchanged and remains the only thing that decides; this stops the admin
 * OFFERING an action that would be refused. Who SHOULD be allowed to adjust
 * stock is a policy question and is deliberately untouched — the panel now
 * simply agrees with whatever the server already decided.
 *
 * The endpoint kept its own local copy of the role list, which is exactly how a
 * UI and a server drift apart. There is one copy now, here.
 */

/** Fixed roles that may move stock. The same set as `canManageInventory`. */
export const INVENTORY_ROLES = [
  "super-admin",
  "admin",
  "operations-manager",
  "inventory",
] as const;

/** Custom-role areas that may move stock. The same set as `canManageInventory`. */
export const INVENTORY_AREAS = ["operations"] as const;

type CustomRoleRef = { isActive?: boolean; areas?: unknown } | string | number | null;
/**
 * Deliberately `unknown`, matching `hasArea` in access/index.ts. The callers
 * hand over three different shapes — a PayloadRequest user on the server and
 * Payload's UntypedUser in the admin `condition` — and narrowing here rather
 * than casting at each call site keeps the fail-closed behaviour in one place.
 */
type MaybeUser = unknown;

type UserShape = { roles?: unknown; customRoles?: unknown };

/** Does this user hold one of the fixed roles? Mirrors `hasRole`. */
const hasFixedRole = (user: UserShape): boolean =>
  Array.isArray(user.roles) &&
  user.roles.some((r) => typeof r === "string" && (INVENTORY_ROLES as readonly string[]).includes(r));

/**
 * Does an ACTIVE custom role grant the area? Mirrors `hasArea` exactly,
 * including its two fail-closed details: an inactive role grants nothing, and a
 * bare unpopulated id — `customRoles` arrives populated only because
 * `users.auth.depth = 1` — grants nothing either.
 */
const hasInventoryArea = (user: UserShape): boolean => {
  const list = user.customRoles;
  if (!Array.isArray(list)) return false;
  return (list as CustomRoleRef[]).some(
    (r) =>
      r !== null &&
      typeof r === "object" &&
      r.isActive !== false &&
      Array.isArray(r.areas) &&
      r.areas.some((a) => typeof a === "string" && (INVENTORY_AREAS as readonly string[]).includes(a)),
  );
};

/**
 * May this user move stock?
 *
 * Deliberately pure and dependency-free: it runs on the SERVER in the endpoint
 * and in the BROWSER as the field's `admin.condition`, so it must not reach for
 * anything server-only. A malformed or absent user is refused rather than
 * assumed — the browser side is only a convenience, and the server is what
 * actually holds.
 */
export function mayAdjustStock(user: MaybeUser): boolean {
  if (!user || typeof user !== "object") return false;
  const u = user as UserShape;
  return hasFixedRole(u) || hasInventoryArea(u);
}
