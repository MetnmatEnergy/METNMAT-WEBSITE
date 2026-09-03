/**
 * Two decisions that bound the cost of the vaporize hero effect, split out of
 * the component (which carries JSX the root test runner cannot transform) so
 * they can be pinned by tests, as pay-flow.ts and particle-render.ts are.
 */

/** The upstream component's supersample. Kept below the cap so DPR-1 and
 *  DPR-1.25 desktops render exactly as they always have. */
export const DPR_SUPERSAMPLE = 1.5;

/**
 * Floor for the canvas backing scale.
 *
 * Every cost in the effect — bytes read back by getImageData, scan-loop
 * iterations, particle objects allocated, draw calls per frame — scales with
 * the SQUARE of this number. Uncapped, devicePixelRatio × 1.5 gave a DPR-2
 * laptop a 3× backing store (9× the CSS pixel count, ~35,000 particles across
 * the six hero canvases) and a DPR-3 tablet 4.5× (20×, ~75,000).
 *
 * A FLAT cap of 2 was the first attempt and it was wrong above DPR 2: a DPR-3
 * tablet would get a backing store of 2 device pixels per CSS pixel for a
 * screen that has 3, so the browser upscales and the reformed text comes back
 * softer than the CSS text beside it. That is a visual regression, not a saving.
 *
 * The rule is therefore "never supersample beyond 1.5×, and never sample below
 * the display's own resolution". Below DPR 4/3 the 1.5× supersample wins and
 * nothing changes; at and above it, the display's own ratio does.
 */
export const DPR_CAP = 2;

export function effectiveDpr(devicePixelRatio: number): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(dpr * DPR_SUPERSAMPLE, Math.max(DPR_CAP, dpr));
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

/**
 * May the cycle advance to the next text on this frame?
 *
 * THE RACE THIS CLOSES. The frame loop reschedules itself unconditionally, and
 * the state it reads is a closure constant captured when the effect ran. When
 * the dissolve finishes, the loop calls setCurrentTextIndex and setAnimationState
 * and then queues another frame — but a setState from a requestAnimationFrame
 * callback is outside React's event system, so the re-render is scheduled as a
 * separate task. Under load that task can slip past the next frame boundary, and
 * the already-queued frame runs again with the SAME closure: still "vaporizing",
 * progress still past 100, every particle still spent, so the branch fires a
 * second time. The updater is functional, so BOTH increments land and the index
 * jumps by two — a stat is skipped.
 *
 * It is worse than a skipped stat. Each slot runs two independent instances, one
 * for the number and one for the label. If the race fires on one and not the
 * other, their indices diverge permanently — nothing reconciles them — and the
 * band shows a number under the wrong caption for the rest of the session. That
 * is exactly the pairing the hero-stats comment promises cannot break.
 *
 * The identical race one branch later was already guarded, for the wait timer.
 * This is the same guard for the advance beside it: the frame that would produce
 * the wrong output is precisely the frame this refuses, so nothing visible
 * changes.
 */
export function shouldAdvance(
  progressPct: number,
  allVaporized: boolean,
  alreadyAdvanced: boolean
): boolean {
  return !alreadyAdvanced && progressPct >= 100 && allVaporized;
}
