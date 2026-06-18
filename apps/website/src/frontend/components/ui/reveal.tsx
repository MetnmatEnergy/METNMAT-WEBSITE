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
};

/**
 * Scroll-triggered fade + rise. Plays once when the element enters the viewport.
 * Honours prefers-reduced-motion — framer-motion uses JS animation, so the global
 * reduced-motion CSS doesn't cover it; we disable the travel here.
 */
export function Reveal({ children, className, delay = 0, y = 18 }: RevealProps) {
  const reduce = useReducedMotion();
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
