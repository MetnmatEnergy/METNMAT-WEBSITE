import { describe, it, expect } from "vitest";
import {
  effectiveDpr,
  isAnimating,
  shouldAdvance,
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

  it("stops supersampling at DPR 4/3, where 1.5x meets the floor", () => {
    expect(effectiveDpr(1.5)).toBe(DPR_CAP);
    expect(effectiveDpr(2)).toBe(DPR_CAP);
  });

  it("NEVER samples below the display own resolution", () => {
    // A flat cap of 2 was the first attempt and it was wrong above DPR 2: a
    // DPR-3 tablet got 2 backing pixels per CSS pixel for a screen with 3, so
    // the browser upscaled and the reformed text came back softer than the CSS
    // text beside it. That is a visual regression, not a saving.
    for (let d = 0.5; d <= 6; d += 0.25) {
      expect(effectiveDpr(d), "backing scale at DPR " + d).toBeGreaterThanOrEqual(Math.min(d, DPR_CAP));
    }
    expect(effectiveDpr(3)).toBe(3);
    expect(effectiveDpr(4)).toBe(4);
  });

  it("never supersamples beyond 1.5x, whatever the display reports", () => {
    for (let d = 0.5; d <= 6; d += 0.25) {
      expect(effectiveDpr(d), "at DPR " + d).toBeLessThanOrEqual(d * DPR_SUPERSAMPLE);
    }
  });

  it("falls back to the plain supersample for a missing or absurd ratio", () => {
    expect(effectiveDpr(0)).toBe(DPR_SUPERSAMPLE);
    expect(effectiveDpr(NaN)).toBe(DPR_SUPERSAMPLE);
    expect(effectiveDpr(-2)).toBe(DPR_SUPERSAMPLE);
  });

  it("cuts the particle field without ever going below native", () => {
    // Particle count is proportional to backing area.
    const before = (d: number) => (d * DPR_SUPERSAMPLE) ** 2;
    const after = (d: number) => effectiveDpr(d) ** 2;
    expect(after(1)).toBe(before(1)); // 2.25 — DPR 1 untouched
    expect(before(2) / after(2)).toBeCloseTo(2.25, 10); // 9 -> 4
    expect(before(3) / after(3)).toBeCloseTo(2.25, 10); // 20.25 -> 9, still native
    for (let d = 1; d <= 4; d += 0.5) {
      expect(after(d), "never below native area at DPR " + d).toBeGreaterThanOrEqual(Math.min(d, DPR_CAP) ** 2);
    }
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

describe("shouldAdvance", () => {
  /**
   * The double-advance race. The frame loop reschedules itself before React can
   * commit, so a duplicate frame re-enters the completed branch with the same
   * closure — still "vaporizing", progress still past 100, particles still
   * spent. With a functional updater both increments land and the index jumps
   * by two: a stat is skipped, and because a slot runs one instance for the
   * number and another for the label, the two can diverge permanently.
   */
  it("advances once when the dissolve has finished", () => {
    expect(shouldAdvance(100, true, false)).toBe(true);
    expect(shouldAdvance(140, true, false)).toBe(true);
  });

  it("refuses the duplicate frame — the whole point", () => {
    expect(shouldAdvance(100, true, true)).toBe(false);
    expect(shouldAdvance(140, true, true)).toBe(false);
  });

  it("does not advance before the dissolve is complete", () => {
    expect(shouldAdvance(99.9, true, false)).toBe(false);
    expect(shouldAdvance(100, false, false)).toBe(false);
    expect(shouldAdvance(0, false, false)).toBe(false);
  });

  it("needs both completion signals, not either", () => {
    // Progress alone is a clock; allVaporized is the particle field actually
    // being spent. The original required both and so does this.
    expect(shouldAdvance(100, false, false)).toBe(false);
    expect(shouldAdvance(50, true, false)).toBe(false);
  });
});
