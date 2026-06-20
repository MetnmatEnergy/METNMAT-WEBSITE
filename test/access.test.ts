import { describe, it, expect, afterEach } from "vitest";
import { hasRole, bootstrapAllowed } from "../apps/dashboard/src/access";

describe("hasRole", () => {
  it("matches when the user has any of the listed roles", () => {
    expect(hasRole({ roles: ["admin"] }, "admin", "super-admin")).toBe(true);
    expect(hasRole({ roles: ["accounts"] }, "super-admin", "admin", "accounts")).toBe(true);
  });

  it("is false when the user lacks the role", () => {
    expect(hasRole({ roles: ["sales"] }, "admin")).toBe(false);
  });

  it("is false for null / undefined / no-roles users", () => {
    expect(hasRole(null, "admin")).toBe(false);
    expect(hasRole(undefined, "admin")).toBe(false);
    expect(hasRole({}, "admin")).toBe(false);
  });
});

describe("bootstrapAllowed", () => {
  const original = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_FIRST_USER_BOOTSTRAP;
  afterEach(() => {
    process.env.NODE_ENV = original;
    if (originalFlag === undefined) delete process.env.ALLOW_FIRST_USER_BOOTSTRAP;
    else process.env.ALLOW_FIRST_USER_BOOTSTRAP = originalFlag;
  });

  it("is allowed outside production", () => {
    process.env.NODE_ENV = "development";
    expect(bootstrapAllowed()).toBe(true);
  });

  it("is BLOCKED in production without the explicit flag", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_FIRST_USER_BOOTSTRAP;
    expect(bootstrapAllowed()).toBe(false);
  });

  it("is allowed in production only with the explicit flag", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_FIRST_USER_BOOTSTRAP = "true";
    expect(bootstrapAllowed()).toBe(true);
  });
});
