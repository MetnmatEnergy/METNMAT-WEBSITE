"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in seconds (e.g. index * 0.06 for grids). */
  delay?: number;
  /** Vertical travel distance on enter. */
  y?: number;
  /**
   * Render visible immediately, with no animation.
   *
   * A Reveal starts at `opacity: 0`, and that is what the SERVER renders. For
   * anything below the fold that is exactly right — you scroll to it and it
   * fades in. For anything ABOVE the fold it means the page ships with its own
   * hero invisible until framer-motion has downloaded, parsed and hydrated, and
   * on /about that included the heading copy and both call-to-action buttons.
   *
   * A visitor on a slow connection sees an empty hero, and a crawler or a
   * screenshot taken before hydration sees the same. Content that is on screen
   * at first paint should be painted.
   */
  immediate?: boolean;
};

/**
 * The same trigger geometry the framer viewport prop used to be given: a margin
 * of -80px, and an amount of "some", which framer maps to a threshold of 0.
 */
const ENTER_MARGIN = "-80px";

/**
 * Has this element entered the viewport yet? One-shot, and it stops observing
 * the moment it has.
 *
 * WHY THIS IS OURS AND NOT `whileInView`. framer-motion 11.18.2 leaks the
 * observation. `InViewFeature.startObserver()` returns the unsubscribe from
 * `observeIntersection` — the function that would call `unobserve(element)` —
 * and `mount()` throws that return value away, while `unmount()` is an empty
 * body. Verified in the installed source. Because the observer itself is cached
 * forever in a module-level WeakMap keyed on `document`, and an
 * IntersectionObserver holds a STRONG reference to every target it observes,
 * nothing is ever released: /about mounts fifteen of these, and each visit
 * leaves fifteen more detached elements permanently observed and permanently
 * alive.
 *
 * Owning the observer costs a few lines and fixes both halves — the element is
 * unobserved as soon as it has been seen (which is all `once: true` ever
 * needed), and the observer is disconnected on unmount.
 *
 * The animation itself is unchanged: same variants, same easing, same duration,
 * same delay, driven by `animate` instead of `whileInView`.
 */
function useHasEntered(ref: React.RefObject<Element | null>): boolean {
  const [entered, setEntered] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Fail open: without IntersectionObserver the content must still appear.
    if (typeof IntersectionObserver === "undefined") {
      setEntered(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setEntered(true);
        io.disconnect(); // once, and never observed again
      },
      { rootMargin: ENTER_MARGIN, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  return entered;
}

/**
 * Scroll-triggered fade + rise. Plays once when the element enters the viewport.
 * Honours prefers-reduced-motion — framer-motion uses JS animation, so the global
 * reduced-motion CSS doesn't cover it; we disable the travel here.
 */
export function Reveal({ children, className, delay = 0, y = 18, immediate = false }: RevealProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const entered = useHasEntered(ref);

  // No motion wrapper at all: the markup is identical to the animated version's
  // resting state, so nothing shifts when the rest of the page finishes
  // hydrating around it.
  if (immediate) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={entered ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}
