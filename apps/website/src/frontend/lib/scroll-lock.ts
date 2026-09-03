/**
 * One reference-counted owner of `document.body.style.overflow`.
 *
 * THE BUG THIS EXISTS FOR. Five places locked the page behind an overlay — the
 * mobile nav, the consent preferences dialog, and the quote drawer, quote modal
 * and filter drawer through `useDialog` — and each did the same thing
 * independently: save whatever `overflow` currently was, write `hidden`, and
 * write the saved value back on close. That is correct for one overlay and
 * wrong for two, because the second one to open saves the FIRST one's `hidden`.
 *
 *   quote drawer opens   → saves ""        → writes hidden
 *   consent prefs opens  → saves "hidden"  → writes hidden
 *   quote drawer closes  → writes ""       → the page scrolls behind an open dialog
 *   consent prefs closes → writes "hidden" → the page is stranded, unscrollable
 *
 * Nothing recovers from that last state except a reload. It needs no unusual
 * timing: the consent dialog can be opened from the footer while any drawer is
 * open, and the mobile nav and the filter drawer share the same viewport.
 *
 * The counter is the whole fix. The first acquire captures the real page state
 * and locks; every later acquire only increments; the last release restores the
 * value captured by the first. Depth can never go negative, and a release can
 * only be honoured once, so a double cleanup — which React does invoke in
 * development — cannot unlock the page underneath an overlay that is still open.
 *
 * The scrollbar gutter is given back as padding, which only the consent dialog
 * used to do. Unifying it means the other four overlays no longer shift the
 * page sideways by the scrollbar width when they open, which is a layout-shift
 * fix rather than a visual change to any of them.
 *
 * The core is pure and injectable because the repo's root test runner is a node
 * environment with no DOM (see vitest.config.ts).
 */

export type ScrollLockState = {
  overflow: string;
  paddingRight: string;
};

export type ScrollLockPort = {
  /** Read the current inline values off the element being locked. */
  read: () => ScrollLockState;
  /** Write inline values onto the element being locked. */
  write: (state: ScrollLockState) => void;
  /** Width of the scrollbar that locking is about to remove, in px. */
  gutter: () => number;
};

export type ScrollLock = {
  /** Lock the page. Returns the matching release; calling it twice is a no-op. */
  acquire: () => () => void;
  /** How many overlays currently hold the lock. Test seam. */
  depth: () => number;
  /** Whether the page is currently locked. Test seam. */
  isLocked: () => boolean;
};

export function createScrollLock(port: ScrollLockPort): ScrollLock {
  let depth = 0;
  let saved: ScrollLockState | null = null;

  return {
    acquire() {
      depth += 1;
      if (depth === 1) {
        // Only the FIRST owner may read the page's real state. Every later
        // reader would see "hidden" and later restore it — the stranding bug.
        saved = port.read();
        const gap = port.gutter();
        port.write({
          overflow: "hidden",
          paddingRight: gap > 0 ? `${gap}px` : saved.paddingRight,
        });
      }

      let released = false;
      return () => {
        if (released) return;
        released = true;
        depth -= 1;
        if (depth <= 0) {
          depth = 0;
          if (saved) {
            port.write(saved);
            saved = null;
          }
        }
      };
    },
    depth: () => depth,
    isLocked: () => depth > 0,
  };
}

/**
 * The browser singleton every overlay shares.
 *
 * Created lazily so importing this module is safe on the server; the port's
 * functions are only ever called from inside an effect.
 */
export const bodyScrollLock: ScrollLock = createScrollLock({
  read: () => ({
    overflow: document.body.style.overflow,
    paddingRight: document.body.style.paddingRight,
  }),
  write: (s) => {
    document.body.style.overflow = s.overflow;
    document.body.style.paddingRight = s.paddingRight;
  },
  // The page loses its scrollbar the moment overflow goes hidden; handing the
  // width back as padding keeps the layout still.
  gutter: () => window.innerWidth - document.documentElement.clientWidth,
});
