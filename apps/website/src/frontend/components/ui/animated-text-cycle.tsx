"use client";

import * as React from "react";
import { useVisibleInViewport } from "@/frontend/lib/use-visible-in-viewport";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";

interface AnimatedTextCycleProps {
  words: string[];
  interval?: number;
  className?: string;
  /**
   * Classes for the outer wrapper. Defaults to reserving ~2 lines for headline
   * use (so long words wrap without shifting the page). Pass e.g. "block
   * whitespace-nowrap" for a single-line pill/badge that shouldn't reserve height.
   */
  wrapperClassName?: string;
}

/**
 * Cycles through words in place. The word inherits the surrounding font size
 * (so it matches the headline), wraps instead of clipping on long phrases, and
 * reserves a fixed two-line height so the layout never jumps as words change.
 * Honours prefers-reduced-motion (plain crossfade, no blur/slide).
 */
export default function AnimatedTextCycle({
  words,
  interval = 5000,
  className = "",
  wrapperClassName = "block min-h-[2.3em]",
}: AnimatedTextCycleProps) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLSpanElement | null>(null);

  /*
   * The interval used to run unconditionally, for the life of the page.
   *
   * The homepage hero mounts two of these, and each tick re-keys an
   * AnimatePresence child, which framer-motion then animates for 0.7 s across
   * opacity, transform and `filter: blur(8px)` — a blur is a per-frame paint
   * over the element's whole box. That ran while the badge was scrolled far off
   * screen, while it was hidden behind a breakpoint (`hidden lg:block`), and
   * while the tab was in the background, where rAF is suspended so the paint
   * never even happened: pure re-render for nothing.
   *
   * Gated on viewport intersection AND tab visibility, the way
   * home/featured-projects-carousel already gates its own timer. An element
   * inside `display: none` reports isIntersecting === false, so the same gate
   * covers the breakpoint case without touching the markup. Anyone who can
   * actually see the badge sees exactly what they saw before.
   */
  const visible = useVisibleInViewport(hostRef);
  const cycling = visible && words.length > 1;

  useEffect(() => {
    if (!cycling) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [cycling, interval, words.length]);

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : "-0.35em", filter: reduce ? "blur(0px)" : "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, y: reduce ? 0 : "0.35em", filter: reduce ? "blur(0px)" : "blur(8px)", transition: { duration: 0.3, ease: "easeIn" } },
  };

  return (
    <span ref={hostRef} className={wrapperClassName}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={index}
          className={`block ${className}`}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
