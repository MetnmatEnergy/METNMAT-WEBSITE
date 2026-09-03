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
 * Scroll-triggered fade + rise. Plays once when the element enters the viewport.
 * Honours prefers-reduced-motion — framer-motion uses JS animation, so the global
 * reduced-motion CSS doesn't cover it; we disable the travel here.
 */
export function Reveal({ children, className, delay = 0, y = 18, immediate = false }: RevealProps) {
  const reduce = useReducedMotion();
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
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}
