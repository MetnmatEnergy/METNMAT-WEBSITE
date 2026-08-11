import { describe, it, expect } from "vitest";
import { safeKeyEqual } from "../apps/website/src/backend/lib/internal-key";
import { safeKeyEqual as dashboardSafeKeyEqual } from "../apps/dashboard/src/lib/internal-key";
import {
  PLACEHOLDER_SECRET,
  isUnusableSecret,
} from "../apps/website/src/backend/lib/placeholder-secret";

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

  // The Terraform placeholder is committed to this repository, so it is a
  // PUBLIC string. Two placeholders comparing equal is the fail-open case, and
  // it is the state production was in on 2026-08-11 — every secret held it while
  // the stack reported healthy. Both implementations must refuse it.
  it("never authenticates the Terraform placeholder, in either app", () => {
    for (const eq of [safeKeyEqual, dashboardSafeKeyEqual]) {
      expect(eq(PLACEHOLDER_SECRET, PLACEHOLDER_SECRET)).toBe(false);
      expect(eq(PLACEHOLDER_SECRET, "a-real-key-value")).toBe(false);
      expect(eq("a-real-key-value", PLACEHOLDER_SECRET)).toBe(false);
    }
  });

  it("still matches a real key that merely contains the placeholder text", () => {
    // Guard against someone "fixing" this with a substring check: only the exact
    // placeholder is rejected, so a legitimately-generated key is unaffected.
    const realistic = `${PLACEHOLDER_SECRET}-but-actually-configured`;
    expect(safeKeyEqual(realistic, realistic)).toBe(true);
    expect(dashboardSafeKeyEqual(realistic, realistic)).toBe(true);
  });
});

describe("isUnusableSecret", () => {
  it("treats unset, blank and placeholder alike", () => {
    expect(isUnusableSecret(undefined)).toBe(true);
    expect(isUnusableSecret("")).toBe(true);
    expect(isUnusableSecret("   ")).toBe(true);
    expect(isUnusableSecret(PLACEHOLDER_SECRET)).toBe(true);
    expect(isUnusableSecret(`  ${PLACEHOLDER_SECRET}  `)).toBe(true);
  });

  it("accepts a genuine value", () => {
    expect(isUnusableSecret("sk_live_9f3a2b")).toBe(false);
  });
});
