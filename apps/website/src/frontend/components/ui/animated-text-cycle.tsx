"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";

interface AnimatedTextCycleProps {
  words: string[];
  interval?: number;
  className?: string;
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
}: AnimatedTextCycleProps) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval, words.length]);

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : "-0.35em", filter: reduce ? "blur(0px)" : "blur(8px)" },
    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, y: reduce ? 0 : "0.35em", filter: reduce ? "blur(0px)" : "blur(8px)", transition: { duration: 0.3, ease: "easeIn" } },
  };

  return (
    // Reserve ~2 lines so a long word can wrap without clipping or shifting the page.
    <span className="block min-h-[2.3em]">
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
