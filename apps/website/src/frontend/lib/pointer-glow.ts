/**
 * The pointer-tracking behind the spotlight cards, as testable logic.
 *
 * WHAT WAS WRONG. Every GlowCard ran its own effect that added a
 * `pointermove` listener to `document` and wrote four CSS custom properties
 * onto its own element. The properties are viewport coordinates, so every card
 * computed and stored the SAME four values. Measured on the production shop
 * page: ten cards, so ten document-level listeners and forty style writes for
 * every pointermove event — and a high-polling-rate mouse fires those well
 * above 60 Hz. Each write invalidates a card painting a radial gradient with
 * `background-attachment: fixed`, which is one of the more expensive things a
 * browser can be asked to repaint.
 *
 * WHAT THIS DOES INSTEAD. One listener for the whole document, no matter how
 * many cards are mounted, throttled to one write per animation frame, writing
 * the four properties once onto the document element. CSS custom properties
 * inherit, and `globals.css` reads them as `var(--x, 0)` on `[data-glow]`
 * without ever setting them locally, so every card resolves exactly the value
 * it used to hold. The rendered pixels are identical.
 *
 * The listener is reference-counted: it binds on the first card and unbinds
 * when the last one unmounts, so a page with no cards carries nothing.
 *
 * Everything is injected so this can be tested in the repo's node runner,
 * which has no DOM.
 */

export type GlowVars = {
  "--x": string;
  "--xp": string;
  "--y": string;
  "--yp": string;
};

/**
 * The four custom properties for a pointer at (x, y) in a viewport of w x h.
 *
 * `toFixed(2)` matches the original exactly. The zero-guard is new: the
 * original divided by `window.innerWidth` unguarded, which yields `Infinity`
 * for a zero-width viewport and writes the string "Infinity" into CSS. A real
 * viewport is never zero, so this changes no rendered output — it only removes
 * a way for the value to become nonsense.
 */
export function glowVars(x: number, y: number, w: number, h: number): GlowVars {
  return {
    "--x": x.toFixed(2),
    "--xp": (w > 0 ? x / w : 0).toFixed(2),
    "--y": y.toFixed(2),
    "--yp": (h > 0 ? y / h : 0).toFixed(2),
  };
}

export type PointerHandler = (x: number, y: number) => void;

export type BroadcasterEnv = {
  addListener: (fn: PointerHandler) => void;
  removeListener: (fn: PointerHandler) => void;
  /** Schedule a write for the next frame; returns a cancellable handle. */
  schedule: (fn: () => void) => number;
  cancel: (handle: number) => void;
  /** Write the properties wherever they should live (the document element). */
  apply: (vars: GlowVars) => void;
  viewport: () => { w: number; h: number };
};

export type PointerBroadcaster = {
  /** Register interest. Returns the unsubscribe for exactly this subscriber. */
  subscribe: () => () => void;
  /** True while the underlying DOM listener is attached. Test seam. */
  isBound: () => boolean;
  /** How many cards currently hold a subscription. Test seam. */
  subscriberCount: () => number;
};

export function createPointerBroadcaster(env: BroadcasterEnv): PointerBroadcaster {
  let subscribers = 0;
  let bound = false;
  let frame: number | null = null;
  let lastX = 0;
  let lastY = 0;

  const flush = () => {
    frame = null;
    const { w, h } = env.viewport();
    env.apply(glowVars(lastX, lastY, w, h));
  };

  // Coalesce to one write per frame. A pointermove burst between two frames
  // would otherwise write the same four properties several times over, and only
  // the last one could ever be seen.
  const onMove: PointerHandler = (x, y) => {
    lastX = x;
    lastY = y;
    if (frame === null) frame = env.schedule(flush);
  };

  return {
    subscribe() {
      subscribers += 1;
      if (!bound) {
        bound = true;
        env.addListener(onMove);
      }
      let released = false;
      return () => {
        // Guard against a double release, which would drop the count below the
        // number of live cards and unbind the listener out from under them.
        if (released) return;
        released = true;
        subscribers -= 1;
        if (subscribers <= 0) {
          subscribers = 0;
          if (bound) {
            bound = false;
            env.removeListener(onMove);
          }
          if (frame !== null) {
            env.cancel(frame);
            frame = null;
          }
        }
      };
    },
    isBound: () => bound,
    subscriberCount: () => subscribers,
  };
}
