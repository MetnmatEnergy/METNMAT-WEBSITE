import { describe, it, expect } from "vitest";
import { shouldStartLoop, type LoopConditions } from "../apps/website/src/frontend/lib/loop-gate";

/**
 * The gate both decorative animation loops now share — the WebGL shader behind
 * the /about hero and the 120-particle canvas on /contact.
 *
 * Both used to start on mount and run until unmount: animating while scrolled
 * off screen, and while the tab sat in the background. The shader was worse
 * still, because its `visibilitychange` handler called start() without
 * consulting its IntersectionObserver, so returning to the tab resumed a
 * full-viewport fragment shader for an element nobody could see.
 */

const running: LoopConditions = {
  alreadyRunning: false,
  prefersReducedMotion: false,
  inView: true,
  pageHidden: false,
};

describe("shouldStartLoop", () => {
  it("runs when the element is on screen, the tab is in front, and nothing is running", () => {
    expect(shouldStartLoop(running)).toBe(true);
  });

  it("refuses while the element is off screen", () => {
    expect(shouldStartLoop({ ...running, inView: false })).toBe(false);
  });

  it("refuses while the tab is hidden", () => {
    expect(shouldStartLoop({ ...running, pageHidden: true })).toBe(false);
  });

  it("refuses for reduced motion — the static frame is already painted", () => {
    expect(shouldStartLoop({ ...running, prefersReducedMotion: true })).toBe(false);
  });

  it("refuses to start a second loop over the top of a running one", () => {
    expect(shouldStartLoop({ ...running, alreadyRunning: true })).toBe(false);
  });

  it("returning to the tab is NOT enough on its own", () => {
    // The exact shader bug: visibilitychange fired start(), and start() did not
    // ask whether the element was still on screen.
    expect(shouldStartLoop({ ...running, pageHidden: false, inView: false })).toBe(false);
  });

  it("scrolling into view is NOT enough while the tab is hidden", () => {
    expect(shouldStartLoop({ ...running, inView: true, pageHidden: true })).toBe(false);
  });

  it("every condition is load-bearing — flipping any one alone refuses", () => {
    const keys: (keyof LoopConditions)[] = [
      "alreadyRunning",
      "prefersReducedMotion",
      "inView",
      "pageHidden",
    ];
    for (const k of keys) {
      expect(shouldStartLoop({ ...running, [k]: !running[k] }), `flipping ${k}`).toBe(false);
    }
  });
});
