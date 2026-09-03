import { describe, it, expect } from "vitest";
import {
  effectiveDpr,
  isAnimating,
  DPR_CAP,
  DPR_SUPERSAMPLE,
} from "../apps/website/src/frontend/lib/vapour-cycle";

/**
 * Two small decisions that bound the vaporize effect's cost, pinned.
 *
 * effectiveDpr — the canvas backing scale. Upstream used devicePixelRatio × 1.5
 * uncapped, and every cost in the effect (pixels read back, scan iterations,
 * particles, draws per frame) scales with its SQUARE: a DPR-2 laptop ran a 3×
 * backing store (9× the CSS pixels) and a DPR-3 tablet 4.5× (20×). The cap
 * leaves DPR-1 and DPR-1.25 desktops pixel-identical and clips everything above.
 *
 * isAnimating — which states the frame loop runs in. `static` and `waiting`
 * are most of every cycle and nothing moves in them.
 */
describe("effectiveDpr", () => {
  it("is unchanged from the original multiplier on ordinary desktops", () => {
    expect(effectiveDpr(1)).toBe(1.5);
    expect(effectiveDpr(1.25)).toBe(1.875);
  });

  it("caps at the ceiling from DPR 4/3 upward", () => {
    expect(effectiveDpr(1.5)).toBe(DPR_CAP);
    expect(effectiveDpr(2)).toBe(DPR_CAP);
    expect(effectiveDpr(3)).toBe(DPR_CAP);
    expect(effectiveDpr(4)).toBe(DPR_CAP);
  });

  it("never exceeds the ceiling, whatever the display reports", () => {
    for (let d = 0.5; d <= 6; d += 0.25) expect(effectiveDpr(d)).toBeLessThanOrEqual(DPR_CAP);
    expect(effectiveDpr(Infinity)).toBe(DPR_CAP);
  });

  it("falls back to the plain supersample for a missing or absurd ratio", () => {
    expect(effectiveDpr(0)).toBe(DPR_SUPERSAMPLE);
    expect(effectiveDpr(NaN)).toBe(DPR_SUPERSAMPLE);
    expect(effectiveDpr(-2)).toBe(DPR_SUPERSAMPLE);
  });

  it("bounds the particle field: at most 4 backing pixels per CSS pixel", () => {
    // Particle count ∝ backing area. What each display paid before, versus now.
    const before = (d: number) => (d * DPR_SUPERSAMPLE) ** 2;
    const after = (d: number) => effectiveDpr(d) ** 2;
    expect(after(1)).toBe(before(1)); // 2.25 — untouched
    expect(before(2) / after(2)).toBeCloseTo(2.25, 10); // 9 → 4
    expect(before(3) / after(3)).toBeCloseTo(5.0625, 10); // 20.25 → 4
    for (let d = 1; d <= 4; d += 0.5) expect(after(d)).toBeLessThanOrEqual(4);
  });
});

describe("isAnimating", () => {
  it("runs the loop only while particles are in flight", () => {
    expect(isAnimating("vaporizing")).toBe(true);
    expect(isAnimating("fadingIn")).toBe(true);
    expect(isAnimating("static")).toBe(false);
    expect(isAnimating("waiting")).toBe(false);
  });
});
