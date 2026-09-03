/**
 * Bail-out helpers for state that is set from an observer callback.
 *
 * THE BUG THESE EXIST FOR — the homepage "Page Unresponsive" freeze.
 *
 * The vaporize text effect had two pieces of state, both objects, both written
 * unconditionally from an observer:
 *
 *   - `wrapperSize`, set by a ResizeObserver on the canvas wrapper,
 *   - the computed display style, set by a ResizeObserver plus a MutationObserver
 *     on the <html> class.
 *
 * React compares state by reference, so `setWrapperSize({ width, height })` is a
 * NEW object every time and always re-renders — even when the numbers are
 * identical. Both of those objects are dependencies of the effect that calls
 * `renderCanvas`, and `renderCanvas`:
 *
 *   1. sets `canvas.style.width/height` and `canvas.width/height` — resizing a
 *      child of the very element the ResizeObserver is watching,
 *   2. calls `getImageData` over the whole canvas,
 *   3. allocates one particle object per opaque pixel.
 *
 * So: observer fires → new object → re-render → effect → canvas resized →
 * observer fires. A synchronous feedback loop that rebuilds tens of thousands of
 * particle objects per iteration, across the six canvases the homepage hero
 * mounts, as fast as the browser can deliver notifications. The main thread
 * never gets to the end of the queue, and Chrome offers to kill the page.
 *
 * The characteristic console signature is "ResizeObserver loop completed with
 * undelivered notifications".
 *
 * Returning the PREVIOUS object when nothing changed makes React bail out of the
 * render entirely, which breaks the cycle at its source. That is the whole fix —
 * no animation changes, no visual change.
 */

export type Size = { width: number; height: number };

/**
 * Next size state, preserving identity when the size has not actually changed.
 *
 * Sub-pixel jitter counts as "not changed" on purpose: a ResizeObserver reports
 * fractional `contentRect` values that can wobble in the last decimal between
 * notifications for a box that is visually static, and treating that as a change
 * is enough on its own to keep the cycle alive.
 */
export function nextSize(prev: Size, width: number, height: number): Size {
  if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
    return prev;
  }
  return { width, height };
}

export type DisplayStyle = {
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
};

/**
 * Next computed-style state, preserving identity when every field matches.
 *
 * The observers that feed this fire on any resize and on any class change to
 * <html>, but the values they read almost never differ — the point of watching
 * is to catch a breakpoint or theme change, which is rare. Without this guard
 * every notification produced a new object, a re-render, and a full particle
 * rebuild.
 */
export function nextDisplayStyle(
  prev: DisplayStyle | null,
  next: DisplayStyle
): DisplayStyle {
  if (
    prev &&
    prev.color === next.color &&
    prev.fontFamily === next.fontFamily &&
    prev.fontSize === next.fontSize &&
    prev.fontWeight === next.fontWeight
  ) {
    return prev;
  }
  return next;
}
