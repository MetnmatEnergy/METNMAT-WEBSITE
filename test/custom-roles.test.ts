import { describe, it, expect } from "vitest";
import {
  hasArea,
  hasRoleOrArea,
  canManageContent,
  canManageCatalog,
  canManageSales,
  canManageOrders,
  canManageTickets,
  canManageAssets,
  canManageSettings,
  canManageAccounts,
  canManageInventory,
  canManageSupport,
  canReadAudit,
  canReadStaff,
  PERMISSION_AREAS,
} from "../apps/dashboard/src/access";

type AnyAccess = (args: { req: { user: unknown } }) => unknown;
const call = (fn: unknown, user: unknown) => (fn as AnyAccess)({ req: { user } });

const withAreas = (...areas: string[]) => ({
  roles: [],
  customRoles: [{ isActive: true, areas }],
});

describe("hasArea", () => {
  it("grants areas from active populated custom roles", () => {
    expect(hasArea(withAreas("content"), "content")).toBe(true);
    expect(hasArea(withAreas("sales", "support"), "support")).toBe(true);
  });
  it("denies areas the roles do not grant", () => {
    expect(hasArea(withAreas("sales"), "content")).toBe(false);
  });
  it("ignores INACTIVE custom roles (kill-switch)", () => {
    expect(hasArea({ customRoles: [{ isActive: false, areas: ["content"] }] }, "content")).toBe(false);
  });
  it("fails closed for unpopulated bare ids, null users and junk", () => {
    expect(hasArea({ customRoles: ["66aabbccddeeff0011223344"] }, "content")).toBe(false);
    expect(hasArea(null, "content")).toBe(false);
    expect(hasArea(undefined, "content")).toBe(false);
    expect(hasArea({}, "content")).toBe(false);
    expect(hasArea({ customRoles: "not-an-array" }, "content")).toBe(false);
  });
  it("unions areas across multiple roles", () => {
    const user = {
      customRoles: [
        { isActive: true, areas: ["sales"] },
        { isActive: true, areas: ["assets"] },
      ],
    };
    expect(hasArea(user, "assets")).toBe(true);
    expect(hasArea(user, "sales")).toBe(true);
    expect(hasArea(user, "settings")).toBe(false);
  });
});

describe("hasRoleOrArea", () => {
  it("passes on fixed role OR area, fails on neither", () => {
    expect(hasRoleOrArea({ roles: ["accounts"] }, ["accounts"], ["accounts"])).toBe(true);
    expect(hasRoleOrArea(withAreas("accounts"), ["accounts"], ["accounts"])).toBe(true);
    expect(hasRoleOrArea({ roles: ["sales"] }, ["accounts"], ["accounts"])).toBe(false);
  });
});

describe("legacy fixed-role behaviour is preserved verbatim", () => {
  it("marketing keeps content/assets/settings + catalog family", () => {
    const marketing = { roles: ["marketing"] };
    expect(call(canManageContent, marketing)).toBe(true);
    expect(call(canManageAssets, marketing)).toBe(true);
    expect(call(canManageSettings, marketing)).toBe(true);
    expect(call(canManageCatalog, marketing)).toBe(true);
    expect(call(canManageSales, marketing)).toBe(true);
    // Deliberate least-privilege change (audit 2026-07-13): orders carry
    // customer PII + payment state — marketing no longer manages them.
    expect(call(canManageOrders, marketing)).toBe(false);
    expect(call(canManageTickets, marketing)).toBe(true);
    expect(call(canManageAccounts, marketing)).toBe(false);
  });
  it("sales keeps the catalog/sales family but not content", () => {
    const sales = { roles: ["sales"] };
    expect(call(canManageSales, sales)).toBe(true);
    expect(call(canManageCatalog, sales)).toBe(true);
    expect(call(canManageContent, sales)).toBe(false);
  });
  it("read-only-auditor keeps audit read", () => {
    expect(call(canReadAudit, { roles: ["read-only-auditor"] })).toBe(true);
  });
});

describe("custom-role areas map to the right helpers (and ONLY those)", () => {
  it("catalog area ≠ sales area (the historical helper is split)", () => {
    const catalogOnly = withAreas("catalog");
    expect(call(canManageCatalog, catalogOnly)).toBe(true);
    expect(call(canManageSales, catalogOnly)).toBe(false);
    expect(call(canManageOrders, catalogOnly)).toBe(false);

    const salesOnly = withAreas("sales");
    expect(call(canManageSales, salesOnly)).toBe(true);
    expect(call(canManageOrders, salesOnly)).toBe(true);
    expect(call(canManageTickets, salesOnly)).toBe(true);
    expect(call(canManageCatalog, salesOnly)).toBe(false);
  });
  it("content area grants content + assets but not settings", () => {
    const content = withAreas("content");
    expect(call(canManageContent, content)).toBe(true);
    expect(call(canManageAssets, content)).toBe(true);
    expect(call(canManageSettings, content)).toBe(false);
  });
  it("settings / assets / support / operations / accounts areas", () => {
    expect(call(canManageSettings, withAreas("settings"))).toBe(true);
    expect(call(canManageContent, withAreas("settings"))).toBe(false);
    expect(call(canManageAssets, withAreas("assets"))).toBe(true);
    expect(call(canManageContent, withAreas("assets"))).toBe(false);
    expect(call(canManageSupport, withAreas("support"))).toBe(true);
    expect(call(canManageTickets, withAreas("support"))).toBe(true);
    expect(call(canManageInventory, withAreas("operations"))).toBe(true);
    expect(call(canManageOrders, withAreas("operations"))).toBe(true);
    expect(call(canManageAccounts, withAreas("accounts"))).toBe(true);
  });
  it("administration area: staff directory + audit read, nothing else", () => {
    const admin = withAreas("administration");
    expect(call(canReadStaff, admin)).toBe(true);
    expect(call(canReadAudit, admin)).toBe(true);
    expect(call(canManageContent, admin)).toBe(false);
    expect(call(canManageAccounts, admin)).toBe(false);
  });
  it("custom roles can NEVER grant admin-level checks", () => {
    // Every area combined still isn't super-admin/admin.
    const everything = withAreas(...PERMISSION_AREAS.map((a) => a.value));
    expect(hasRoleOrArea(everything, ["super-admin", "admin"], [])).toBe(false);
  });
});
