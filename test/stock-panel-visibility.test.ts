import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INVENTORY_AREAS,
  INVENTORY_ROLES,
  mayAdjustStock,
} from "../apps/dashboard/src/lib/inventory-access";

/**
 * The Adjust-stock panel was shown to everyone and accepted from almost nobody.
 *
 * The panel is a Payload `ui` field (Products.ts) with `admin.components.Field`
 * and NOTHING else — no `admin.condition`. A `ui` field cannot carry field
 * `access` either, because it holds no data, so the only thing deciding whether
 * it renders was the collection's READ permission. The server endpoint
 * (`endpoints/stock.ts`) accepts a strictly narrower set: the same membership as
 * `canManageInventory`.
 *
 * So the panel rendered, live and interactive, for staff the server would refuse
 * — including a read-only auditor, whose entire form Payload renders read-only
 * EXCEPT a custom Field component, because Payload passes it no `readOnly` prop.
 * The default role for a new staff account is `sales`, which is one of the
 * refused ones, so the mismatch was the default experience rather than an edge.
 *
 * WHAT IS AND IS NOT CHANGED. The server stays exactly as authoritative as it
 * was — this adds no permission to anyone and removes none. It only stops
 * offering an action that would be refused. The RBAC policy question of who
 * SHOULD adjust stock is untouched; the panel now simply agrees with whatever
 * the server already decided.
 *
 * The two are driven from one exported membership so they cannot drift, which
 * is what made this possible in the first place: the endpoint had its own local
 * copy of the role list.
 */

/**
 * A staff user in the shape access/index.ts actually reads: fixed `roles`,
 * plus POPULATED `customRoles` objects carrying their own `areas`. An earlier
 * draft of this test used a flat `areas` array, which is not the shape hasArea
 * resolves — the fixture would have passed against a predicate that was wrong.
 */
const staff = (roles: string[], areas: string[] = []) => ({
  roles,
  customRoles: areas.length ? [{ isActive: true, areas }] : [],
});

describe("who the server accepts", () => {
  it.each(INVENTORY_ROLES)("%s may adjust stock", (role) => {
    expect(mayAdjustStock(staff([role]))).toBe(true);
  });

  it.each(INVENTORY_AREAS)("the %s area may adjust stock", (area) => {
    expect(mayAdjustStock(staff(["custom"], [area]))).toBe(true);
  });

  it.each(["marketing", "sales", "technical", "accounts", "support", "read-only-auditor"])(
    "%s may NOT adjust stock",
    (role) => {
      // Every one of these saw a fully interactive panel before.
      expect(mayAdjustStock(staff([role]))).toBe(false);
    },
  );

  it("the default role for a new staff account is one of the refused ones", () => {
    // Which is why this was the default experience, not an edge case.
    expect(mayAdjustStock(staff(["sales"]))).toBe(false);
  });

  it("an unauthenticated or malformed user is refused", () => {
    expect(mayAdjustStock(null)).toBe(false);
    expect(mayAdjustStock(undefined)).toBe(false);
    expect(mayAdjustStock({})).toBe(false);
    expect(mayAdjustStock({ roles: "admin" })).toBe(false);
    expect(mayAdjustStock(staff([]))).toBe(false);
  });

  it("a non-object user is refused", () => {
    // These pass with or without the `typeof user === "object"` guard — a
    // string has no `.roles`, so both paths reach false. The guard is a typing
    // contract rather than a behavioural one, and this records the contract
    // rather than pretending the check is load-bearing.
    expect(mayAdjustStock("super-admin")).toBe(false);
    expect(mayAdjustStock(42)).toBe(false);
    expect(mayAdjustStock(true)).toBe(false);
  });

  it("an unrelated area does not grant it", () => {
    expect(mayAdjustStock(staff(["custom"], ["content"]))).toBe(false);
    expect(mayAdjustStock(staff(["custom"], ["assets"]))).toBe(false);
  });

  it("an INACTIVE custom role grants nothing, as hasArea requires", () => {
    expect(mayAdjustStock({ roles: ["custom"], customRoles: [{ isActive: false, areas: ["operations"] }] })).toBe(false);
  });

  it("an unpopulated custom-role id grants nothing — fail closed", () => {
    // customRoles arrives populated only because users.auth.depth = 1. A bare
    // id must not be read as "probably fine".
    expect(mayAdjustStock({ roles: ["custom"], customRoles: ["role-id-123"] })).toBe(false);
  });
});

describe("the membership matches canManageInventory exactly", () => {
  const SRC = join(__dirname, "..", "apps", "dashboard", "src");

  it("names the same four roles", () => {
    const access = readFileSync(join(SRC, "access", "index.ts"), "utf8");
    const at = access.indexOf("export const canManageInventory");
    const body = access.slice(at, at + 260);
    for (const role of INVENTORY_ROLES) {
      expect(body, `canManageInventory should include ${role}`).toContain(`"${role}"`);
    }
  });

  it("names the same area", () => {
    const access = readFileSync(join(SRC, "access", "index.ts"), "utf8");
    const at = access.indexOf("export const canManageInventory");
    expect(access.slice(at, at + 260)).toContain('"operations"');
    expect(INVENTORY_AREAS).toEqual(["operations"]);
  });

  it("the endpoint uses the shared list rather than its own copy", () => {
    // It had a local INVENTORY_ROLES array. Two copies of a permission list is
    // how the UI and the server drifted apart in the first place.
    const src = readFileSync(join(SRC, "endpoints", "stock.ts"), "utf8");
    expect(src).toMatch(/from "\.\.\/lib\/inventory-access"/);
    expect(src).not.toMatch(/const INVENTORY_ROLES: Role\[\] =/);
  });

  it("the endpoint still checks on the server — the UI is not trusted", () => {
    const src = readFileSync(join(SRC, "endpoints", "stock.ts"), "utf8");
    expect(src).toMatch(/mayAdjustStock\(/);
    expect(src).toMatch(/status: 401/);
  });
});

describe("the panel is gated to the same set", () => {
  // Comments stripped first, as elsewhere in this suite: the field now carries
  // a long explanatory note, and prose must neither satisfy an assertion nor
  // push the code out of a fixed-size window.
  const products = readFileSync(
    join(__dirname, "..", "apps", "dashboard", "src", "collections", "Products.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  const field = () => {
    const at = products.indexOf('name: "stockAdjust"');
    expect(at, "the stockAdjust field").toBeGreaterThan(-1);
    return products.slice(at, at + 400);
  };

  it("the stockAdjust ui field carries a condition", () => {
    expect(field()).toMatch(/condition:/);
  });

  it("the condition asks the shared predicate, not its own role list", () => {
    expect(field()).toMatch(/mayAdjustStock\(/);
  });

  it("the panel component is still wired", () => {
    // Hiding it from the wrong people must not hide it from the right ones.
    expect(field()).toMatch(/Field: "\/admin\/StockAdjust"/);
  });
});

describe("the Payload behaviour that made this necessary", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, "apps/dashboard/node_modules", p), "utf8");

  it("admin.condition receives the user, so it can mirror the server rule", () => {
    const types = read("payload/dist/fields/config/types.d.ts");
    expect(types).toMatch(/condition\?:/);
    expect(types).toMatch(/user:/);
  });
});
