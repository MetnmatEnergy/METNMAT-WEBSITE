import { describe, it, expect } from "vitest";
import {
  renderParticles,
  ALPHA_STEPS,
  type Particle,
  type ParticleContext,
} from "../apps/website/src/frontend/lib/particle-render";

/**
 * The "Page Unresponsive" bug.
 *
 * This function used to do three expensive things per particle per frame: a
 * regex replace on a colour string, a `fillStyle` assignment (which re-parses a
 * CSS colour), and a 1x1 `fillRect` that could not batch because the style had
 * just changed.
 *
 * The particle count is not small. Sampling uses `max(1, round(DPR / 3))`, which
 * is 1 on every ordinary display, so every opaque pixel of the rendered text
 * becomes a particle — and the homepage hero mounts SIX of these canvases at
 * once, all above the fold and therefore all animating together. Tens of
 * thousands of regex runs and unbatchable draw calls, sixty times a second, is a
 * main thread that never yields, and Chrome offers to kill the page.
 *
 * So the thing worth asserting is not "does it look right" — it is HOW MANY
 * canvas operations one frame costs. These tests count them.
 */

/** A context that records what was asked of it. */
function recorder() {
  const styleAssignments: string[] = [];
  const rects: Array<[number, number, number, number]> = [];
  let current = "";
  const ctx: ParticleContext = {
    save() {},
    restore() {},
    scale() {},
    fillRect(x, y, w, h) {
      rects.push([x, y, w, h]);
    },
    get fillStyle() {
      return current;
    },
    set fillStyle(v: string | CanvasGradient | CanvasPattern) {
      current = String(v);
      styleAssignments.push(current);
    },
  };
  return { ctx, styleAssignments, rects };
}

const WHITE = "rgba(255, 255, 255, ";

function particle(x: number, y: number, opacity: number, prefix = WHITE): Particle {
  return {
    x,
    y,
    originalX: x,
    originalY: y,
    color: `${prefix}${opacity})`,
    rgbPrefix: prefix,
    opacity,
    originalAlpha: opacity,
    velocityX: 0,
    velocityY: 0,
    angle: 0,
    speed: 0,
  };
}

/** A solid horizontal run, which is what a glyph's interior actually looks like. */
const solidRow = (n: number, y = 0) =>
  Array.from({ length: n }, (_, i) => particle(i, y, 1));

describe("cost per frame", () => {
  it("assigns fillStyle ONCE for a thousand identical particles, not a thousand times", () => {
    // This is the regression. One assignment is one CSS colour parse; the old
    // code did one per particle, which at ~30,000 particles across six canvases
    // is what stopped the renderer answering input.
    const { ctx, styleAssignments } = recorder();
    renderParticles(ctx, solidRow(1000), 1);
    expect(styleAssignments).toHaveLength(1);
  });

  it("merges a solid run into ONE rect instead of a thousand", () => {
    const { ctx, rects } = recorder();
    renderParticles(ctx, solidRow(1000), 1);
    expect(rects).toHaveLength(1);
  });

  it("keeps both costs flat as the particle count grows", () => {
    // The old implementation was strictly linear in both. If either of these
    // starts scaling with n again, the freeze is back.
    for (const n of [100, 1000, 5000]) {
      const { ctx, styleAssignments, rects } = recorder();
      renderParticles(ctx, solidRow(n), 1);
      expect(styleAssignments.length, `styles at n=${n}`).toBe(1);
      expect(rects.length, `rects at n=${n}`).toBe(1);
    }
  });

  it("does not re-assign the style across separate rows of the same colour", () => {
    const { ctx, styleAssignments, rects } = recorder();
    renderParticles(ctx, [...solidRow(10, 0), ...solidRow(10, 1)], 1);
    // Two rows cannot merge into one rect, but they share a colour.
    expect(rects).toHaveLength(2);
    expect(styleAssignments).toHaveLength(1);
  });
});

describe("pixels are unchanged", () => {
  it("a merged run covers exactly what the individual rects covered", () => {
    // Each particle paints dpr device pixels wide, so L particles starting at
    // device x span [x, x + L - 1 + dpr) — (L-1)/dpr + 1 in the scaled space.
    const dpr = 3;
    const { ctx, rects } = recorder();
    renderParticles(ctx, solidRow(10), dpr);
    const [x, y, w, h] = rects[0];
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(h).toBe(1);
    expect(w).toBeCloseTo((10 - 1) / dpr + 1, 10);
    // The last particle alone would have covered up to 9/dpr + 1 — the same edge.
    expect(x + w).toBeCloseTo(9 / dpr + 1, 10);
  });

  it("does NOT merge translucent particles, whose overlap composites differently", () => {
    // Antialiased glyph edges are below full alpha. Merging them would darken
    // the overlap and visibly thicken every letter.
    const { ctx, rects } = recorder();
    const edge = Array.from({ length: 5 }, (_, i) => particle(i, 0, 0.5));
    renderParticles(ctx, edge, 1);
    expect(rects).toHaveLength(5);
    for (const r of rects) expect(r[2]).toBe(1);
  });

  it("breaks a run where a translucent pixel interrupts it", () => {
    const { ctx, rects } = recorder();
    renderParticles(ctx, [particle(0, 0, 1), particle(1, 0, 0.4), particle(2, 0, 1)], 1);
    // solid | translucent | solid — three separate draws, no bridging.
    expect(rects).toHaveLength(3);
  });

  it("skips fully transparent particles entirely", () => {
    const { ctx, rects, styleAssignments } = recorder();
    renderParticles(ctx, [particle(0, 0, 0), particle(1, 0, 0)], 1);
    expect(rects).toHaveLength(0);
    expect(styleAssignments).toHaveLength(0);
  });

  it("separates particles of different colours", () => {
    const { ctx, styleAssignments } = recorder();
    renderParticles(ctx, [particle(0, 0, 1), particle(1, 0, 1, "rgba(216, 31, 38, ")], 1);
    expect(styleAssignments).toHaveLength(2);
  });

  it("quantises alpha finely enough to be invisible", () => {
    // 1/63 of an 8-bit channel is below what a display can resolve.
    expect(ALPHA_STEPS).toBeGreaterThanOrEqual(32);
    const { ctx, styleAssignments } = recorder();
    renderParticles(ctx, [particle(0, 0, 1)], 1);
    expect(styleAssignments[0]).toBe("rgba(255, 255, 255, 1)");
  });

  it("draws a non-contiguous solid row as separate rects", () => {
    const { ctx, rects } = recorder();
    // A gap in x means the pixels are not adjacent and must not be bridged.
    renderParticles(ctx, [particle(0, 0, 1), particle(5, 0, 1)], 1);
    expect(rects).toHaveLength(2);
  });
});
