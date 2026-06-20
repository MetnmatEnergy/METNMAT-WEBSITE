import { describe, it, expect } from "vitest";
import { safeKeyEqual } from "../apps/website/src/backend/lib/internal-key";
import { safeKeyEqual as dashboardSafeKeyEqual } from "../apps/dashboard/src/lib/internal-key";

describe("safeKeyEqual (constant-time compare)", () => {
  it("returns true only for an exact match", () => {
    expect(safeKeyEqual("super-secret-key", "super-secret-key")).toBe(true);
    expect(safeKeyEqual("super-secret-key", "super-secret-kex")).toBe(false);
  });

  it("returns false on length mismatch (no throw)", () => {
    expect(safeKeyEqual("short", "a-much-longer-secret")).toBe(false);
  });

  it("returns false for any falsy input", () => {
    expect(safeKeyEqual(null, "x")).toBe(false);
    expect(safeKeyEqual("x", undefined)).toBe(false);
    expect(safeKeyEqual("", "")).toBe(false);
    expect(safeKeyEqual(undefined, undefined)).toBe(false);
  });

  it("dashboard and website implementations agree", () => {
    expect(dashboardSafeKeyEqual("k", "k")).toBe(true);
    expect(dashboardSafeKeyEqual("k", "j")).toBe(false);
  });
});
