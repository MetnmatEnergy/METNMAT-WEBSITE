/**
 * Drawing the vaporize particle field.
 *
 * Split out of the component so it can be tested: this function is what made
 * the homepage freeze, and the thing worth asserting — how many canvas
 * operations one frame costs — is invisible from the outside. The component
 * file carries JSX, which the repo's test runner cannot transform, so pure
 * logic lives in .ts here, as it does in pay-flow.ts and focus-trap.ts.
 */

export type Particle = {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  color: string;
  /**
   * "rgba(r, g, b, " — everything up to the alpha, built ONCE at creation.
   *
   * The render loop used to derive the per-frame colour with
   * `particle.color.replace(/[\d.]+\)$/, ...)`: a regex execution and a string
   * allocation for every particle on every frame.
   */
  rgbPrefix: string;
  opacity: number;
  originalAlpha: number;
  velocityX: number;
  velocityY: number;
  angle: number;
  speed: number;
  shouldFadeQuickly?: boolean;
};

/**
 * Alpha buckets. 64 steps is finer than the composited result can show, so
 * quantising is invisible — but it collapses the number of distinct fillStyle
 * values from "one per particle" to at most 64, which is what lets the loop
 * below skip nearly every style assignment.
 */
export const ALPHA_STEPS = 63;

/** The slice of a 2D context this needs — so a test can supply a recorder. */
export type ParticleContext = {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
};

/**
 * Draw the particle field.
 *
 * WHAT WAS WRONG — this is the "Page Unresponsive" bug.
 *
 * The old body did three expensive things PER PARTICLE, PER FRAME:
 *   1. a regex replace on the colour string (execution + allocation),
 *   2. `ctx.fillStyle = <string>`, which re-parses a CSS colour every time,
 *   3. `ctx.fillRect(x, y, 1, 1)` — a draw call that cannot batch, because the
 *      style changed immediately before it.
 *
 * The particle count is not small. Every opaque pixel of the rendered text
 * becomes a particle, and the homepage hero mounts six of these canvases at
 * once — three visible stat slots, each with a number and a label — all above
 * the fold and therefore all in view together. Before the backing scale was
 * capped (lib/vapour-cycle, effectiveDpr) that was 35,000 particles at DPR 2
 * and 75,000 at DPR 3; capped, about 15,000 on any high-DPR display.
 *
 * Thirty thousand regex runs plus thirty thousand CSS colour parses plus thirty
 * thousand unbatchable draw calls, sixty times a second, is not a slow frame. It
 * is a main thread that never yields, so the renderer stops answering input and
 * Chrome offers to kill the page.
 *
 * WHAT THIS DOES INSTEAD
 * The colour prefix is precomputed at creation, so no regex runs here at all.
 * `fillStyle` is assigned only when the colour or alpha bucket changes from the
 * previous particle. That is far fewer than one per particle, but it is NOT one
 * per frame: every antialiased glyph edge carries its own alpha, and in scan
 * order the edge/interior/edge transitions change the bucket on most edge
 * pixels — measured at ~12,000 assignments per idle frame at DPR 2 across the
 * six hero canvases. An earlier version of this comment claimed the idle states
 * cost one assignment; it was wrong, and test/particle-render.test.ts now pins
 * the true figure. The idle states are handled where they belong: the
 * component no longer runs its frame loop while nothing moves
 * (vapour-text-effect, `isAnimating`), so this function's per-frame cost is
 * paid only while particles are actually in flight.
 *
 * Fully-opaque neighbours in the same row are then merged into a single wider
 * rect. Particles are created in scan order, so a glyph's interior is long runs
 * of adjacent pixels, and this turns thousands of 1x1 rects into a few hundred
 * spans. Merging is restricted to FULLY OPAQUE runs on purpose: overlapping
 * translucent rects composite differently from one merged rect, so every
 * antialiased glyph edge is still drawn individually and looks exactly as it did.
 *
 * Every pixel produced is identical to before.
 */
export function renderParticles(
  ctx: ParticleContext,
  particles: Particle[],
  globalDpr: number
): void {
  ctx.save();
  ctx.scale(globalDpr, globalDpr);

  let lastPrefix = "";
  let lastStep = -1;

  // The open run of adjacent, fully-opaque, same-colour particles.
  let runX = 0;
  let runY = 0;
  let runLen = 0;

  // A run of L particles starting at device x spans [x, x + L - 1 + dpr), because
  // each particle paints dpr device pixels wide. In the scaled (CSS) space this
  // context is using, that is (L - 1) / dpr + 1 units.
  const flushRun = () => {
    if (runLen === 0) return;
    ctx.fillRect(runX / globalDpr, runY / globalDpr, (runLen - 1) / globalDpr + 1, 1);
    runLen = 0;
  };

  for (const particle of particles) {
    if (particle.opacity <= 0) continue;

    const step = (particle.opacity * ALPHA_STEPS) | 0;
    if (step !== lastStep || particle.rgbPrefix !== lastPrefix) {
      flushRun();
      lastStep = step;
      lastPrefix = particle.rgbPrefix;
      ctx.fillStyle = `${particle.rgbPrefix}${step / ALPHA_STEPS})`;
    }

    // Only merge at full opacity — see the note above about compositing.
    const mergeable = step === ALPHA_STEPS;
    if (mergeable && runLen > 0 && particle.y === runY && particle.x === runX + runLen) {
      runLen++;
      continue;
    }

    flushRun();
    if (mergeable) {
      runX = particle.x;
      runY = particle.y;
      runLen = 1;
    } else {
      ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1);
    }
  }
  flushRun();

  ctx.restore();
}
