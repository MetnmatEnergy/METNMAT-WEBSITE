import { describe, it, expect } from "vitest";
import { checkProductMaster, PRODUCT_IMAGE_SPEC } from "../apps/dashboard/src/hooks/product-image-spec";

/**
 * The product-master rule (4:3, ≥2400px wide) is enforced on upload AND reported
 * by the audit script. Both read this one helper, so these cases pin the
 * contract between them — a drift here would let the admin accept a photo the
 * audit flags, or vice versa.
 */
describe("checkProductMaster", () => {
  it("accepts the canonical master", () => {
    const r = checkProductMaster(2400, 1800);
    expect(r.ok).toBe(true);
    expect(r.ratio).toBeCloseTo(4 / 3, 5);
  });

  it("accepts larger images that are still exactly 4:3", () => {
    expect(checkProductMaster(3200, 2400).ok).toBe(true);
    expect(checkProductMaster(4800, 3600).ok).toBe(true);
  });

  it("rejects the common wrong shapes", () => {
    expect(checkProductMaster(1500, 1500).ratioOk).toBe(false); // 1:1
    expect(checkProductMaster(1920, 1080).ratioOk).toBe(false); // 16:9
    expect(checkProductMaster(2400, 1600).ratioOk).toBe(false); // 3:2
    expect(checkProductMaster(1800, 2400).ratioOk).toBe(false); // portrait
  });

  it("rejects a correctly-shaped image that is too small to zoom", () => {
    const r = checkProductMaster(800, 600);
    expect(r.ratioOk).toBe(true);
    expect(r.wideEnough).toBe(false);
    expect(r.ok).toBe(false);
  });

  it("tolerates a pixel or two of rounding, but not a real crop", () => {
    // A 1px export rounding error must pass — re-exporting 200 photos over that
    // would be absurd.
    expect(checkProductMaster(2401, 1800).ratioOk).toBe(true);
    expect(checkProductMaster(2400, 1799).ratioOk).toBe(true);
    // ~2% off is a genuinely different shape and must fail.
    expect(checkProductMaster(2400, 1760).ratioOk).toBe(false);
  });

  it("keeps the tolerance tight enough to matter", () => {
    // Guards against someone "fixing" a failing upload by widening tolerance
    // until 16:9 slips through.
    expect(PRODUCT_IMAGE_SPEC.ratioTolerance).toBeLessThanOrEqual(0.01);
    expect(checkProductMaster(1920, 1080).ratioOk).toBe(false);
  });

  it("exposes a minimum width that supports the 2400px zoom variant", () => {
    expect(PRODUCT_IMAGE_SPEC.minWidth).toBeGreaterThanOrEqual(2400);
  });
});
