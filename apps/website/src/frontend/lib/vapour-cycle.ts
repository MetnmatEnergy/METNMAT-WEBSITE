/**
 * Two decisions that bound the cost of the vaporize hero effect, split out of
 * the component (which carries JSX the root test runner cannot transform) so
 * they can be pinned by tests, as pay-flow.ts and particle-render.ts are.
 */

/** The upstream component's supersample. Kept below the cap so DPR-1 and
 *  DPR-1.25 desktops render exactly as they always have. */
export const DPR_SUPERSAMPLE = 1.5;

/**
 * Ceiling on the canvas backing scale.
 *
 * Every cost in the effect — bytes read back by getImageData, scan-loop
 * iterations, particle objects allocated, draw calls per frame — scales with
 * the SQUARE of this number. Uncapped, devicePixelRatio × 1.5 gave a DPR-2
 * laptop a 3× backing store (9× the CSS pixel count, ~35,000 particles across
 * the six hero canvases) and a DPR-3 tablet 4.5× (20×, ~75,000). Sampling at
 * 2× is already the display's own resolution on the sharpest common screens,
 * and each particle paints one CSS pixel through ctx.scale, so nothing
 * visible is lost above the cap.
 */
export const DPR_CAP = 2;

export function effectiveDpr(devicePixelRatio: number): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr * DPR_SUPERSAMPLE, DPR_CAP);
}

export type CycleState = "static" | "vaporizing" | "fadingIn" | "waiting";

/**
 * Whether the frame loop has anything to do. `static` and `waiting` are most
 * of every cycle (3.4 s of 5.4 s on the homepage) and nothing moves in them;
 * the component paints the settled text once and schedules no frame.
 */
export function isAnimating(state: CycleState): boolean {
  return state === "vaporizing" || state === "fadingIn";
}
