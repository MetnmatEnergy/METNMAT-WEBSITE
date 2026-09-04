"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Is this element worth animating right now — on screen AND in a foreground tab?
 *
 * Four components had grown their own copy of this wiring (an
 * IntersectionObserver, a `visibilitychange` listener, and the `&&` between
 * them), and two more had no gate at all. Copies drift: the WebGL shader on
 * /about ended up checking the viewport in one of its two callers and forgetting
 * it in the other, so returning to the tab resumed a full-viewport fragment
 * shader for an element scrolled far out of sight. One implementation, tested
 * once, is the fix for that class of bug rather than for one instance of it.
 *
 * This answers a CONTINUOUS question — "should the loop be running at this
 * moment" — and the answer changes both ways. It is deliberately not the same
 * question as "has this element ever been seen", which is one-shot and is what
 * a scroll-triggered reveal needs; that one unobserves as soon as it fires.
 *
 * Fails OPEN: without IntersectionObserver the element is treated as visible,
 * so a browser that lacks it still gets the animation rather than a dead one.
 */
export function useVisibleInViewport(
  ref: RefObject<Element | null>,
  options?: { threshold?: number }
): boolean {
  const threshold = options?.threshold ?? 0;
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setInView(Boolean(entries[0]?.isIntersecting)),
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);

  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return inView && pageVisible;
}
