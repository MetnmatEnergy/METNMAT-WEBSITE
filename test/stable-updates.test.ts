import { describe, it, expect } from "vitest";
import {
  nextSize,
  nextDisplayStyle,
  type Size,
  type DisplayStyle,
} from "../apps/website/src/frontend/lib/stable-updates";

/**
 * The homepage "Page Unresponsive" freeze.
 *
 * The vaporize text effect wrote two object states unconditionally from observer
 * callbacks: `wrapperSize` from a ResizeObserver on the canvas wrapper, and the
 * computed display style from a ResizeObserver plus a MutationObserver on the
 * <html> class.
 *
 * React compares state by reference, so a fresh object always re-renders even
 * when every value is identical. Both objects are dependencies of the effect
 * that calls `renderCanvas`, and `renderCanvas` resizes the canvas — a child of
 * the element the ResizeObserver is watching — then re-samples it with
 * `getImageData` and allocates one particle per opaque pixel.
 *
 *   observer fires -> new object -> re-render -> effect -> canvas resized -> observer fires
 *
 * A synchronous feedback loop rebuilding tens of thousands of particles per
 * iteration, across six canvases, as fast as notifications arrive.
 *
 * So the property under test is IDENTITY, not equality. Returning an equal-but-
 * new object would leave the loop exactly as it was; only returning the SAME
 * reference makes React bail out of the render.
 */

const size = (width: number, height: number): Size => ({ width, height });

const style = (over: Partial<DisplayStyle> = {}): DisplayStyle => ({
  color: "rgb(10, 10, 11)",
  fontFamily: "Inter, sans-serif",
  fontSize: "44px",
  fontWeight: 700,
  ...over,
});

describe("nextSize", () => {
  it("returns the SAME REFERENCE when the size is unchanged", () => {
    const prev = size(176, 44);
    expect(nextSize(prev, 176, 44)).toBe(prev);
  });

  it("returns a new object when the size really changes", () => {
    const prev = size(176, 44);
    const out = nextSize(prev, 320, 44);
    expect(out).not.toBe(prev);
    expect(out).toEqual({ width: 320, height: 44 });
  });

  it("treats sub-pixel jitter as unchanged", () => {
    // ResizeObserver reports fractional contentRect values that wobble in the
    // last decimal for a visually static box. Treating that as a change is
    // enough on its own to keep the loop alive.
    const prev = size(176.0001, 44);
    expect(nextSize(prev, 176.4, 44)).toBe(prev);
    expect(nextSize(prev, 175.7, 44.2)).toBe(prev);
  });

  it("still reacts to a real breakpoint change", () => {
    const prev = size(176, 44);
    expect(nextSize(prev, 176, 36)).not.toBe(prev);
    expect(nextSize(prev, 177, 44)).not.toBe(prev);
  });

  it("settles after ONE update under a storm of identical notifications", () => {
    // This is the loop, written out. A hundred observer callbacks reporting the
    // same box must produce exactly one state object; the old code produced a
    // hundred, and each one re-ran the particle rebuild.
    let state = size(0, 0);
    const seen = new Set<Size>();
    for (let i = 0; i < 100; i++) {
      state = nextSize(state, 176, 44);
      seen.add(state);
    }
    // The initial zero-size object, then one real update. Never more.
    expect(seen.size).toBe(1);
    expect(state).toEqual({ width: 176, height: 44 });
  });
});

describe("nextDisplayStyle", () => {
  it("returns the SAME REFERENCE when every field matches", () => {
    const prev = style();
    expect(nextDisplayStyle(prev, style())).toBe(prev);
  });

  it("returns the new object on a theme change", () => {
    const prev = style({ color: "rgb(10, 10, 11)" });
    const next = style({ color: "rgb(250, 250, 250)" });
    expect(nextDisplayStyle(prev, next)).toBe(next);
  });

  it("returns the new object on a breakpoint change", () => {
    const prev = style({ fontSize: "44px" });
    const next = style({ fontSize: "36px" });
    expect(nextDisplayStyle(prev, next)).toBe(next);
  });

  it("accepts the very first read, when there is nothing to compare against", () => {
    const next = style();
    expect(nextDisplayStyle(null, next)).toBe(next);
  });

  it("settles after ONE update under a storm of identical reads", () => {
    let state: DisplayStyle | null = null;
    const seen = new Set<DisplayStyle>();
    for (let i = 0; i < 100; i++) {
      state = nextDisplayStyle(state, style());
      seen.add(state);
    }
    expect(seen.size).toBe(1);
  });

  it("notices a change in any single field", () => {
    const prev = style();
    for (const over of [
      { color: "rgb(1, 2, 3)" },
      { fontFamily: "Georgia, serif" },
      { fontSize: "12px" },
      { fontWeight: 400 },
    ]) {
      expect(nextDisplayStyle(prev, style(over)), JSON.stringify(over)).not.toBe(prev);
    }
  });
});
