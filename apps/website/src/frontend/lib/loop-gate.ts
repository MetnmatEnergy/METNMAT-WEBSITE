/**
 * When may a continuous animation loop run?
 *
 * Two decorative loops answer this the same way — the WebGL shader behind the
 * /about hero and the particle canvas on /contact — and both used to get it
 * wrong in the same two ways. They started on mount and ran until unmount,
 * so they animated while scrolled off screen and while the tab was in the
 * background; and the shader's `visibilitychange` handler called start()
 * without consulting its IntersectionObserver, so returning to the tab resumed
 * a full-viewport fragment shader for an element nobody could see.
 *
 * Expressing it as one predicate means the rule is unit-tested once rather than
 * re-derived per component, and a component that forgets a condition fails a
 * test instead of quietly burning frames.
 *
 * Reduced motion is included deliberately: both callers paint a single static
 * frame up front, so refusing the loop leaves the visual intact and simply
 * stops it moving.
 */

export type LoopConditions = {
  /** The loop is already scheduled; starting again would double it. */
  alreadyRunning: boolean;
  /** The visitor asked for reduced motion. */
  prefersReducedMotion: boolean;
  /** The element is intersecting the viewport. */
  inView: boolean;
  /** document.hidden — the tab is backgrounded. */
  pageHidden: boolean;
};

export function shouldStartLoop(c: LoopConditions): boolean {
  return !c.alreadyRunning && !c.prefersReducedMotion && c.inView && !c.pageHidden;
}
