"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

interface HandWrittenTitleProps {
  title?: string;
  subtitle?: string;
}

/**
 * Hand-drawn circle that "writes" itself around a title on load. The SVG is sized
 * to the title box and stretched (preserveAspectRatio="none") so the loop always
 * encircles the WHOLE title regardless of its width/breakpoint; a non-scaling
 * stroke keeps the line an even thickness despite the stretch. Brand-colored;
 * honours prefers-reduced-motion (draws instantly).
 */
function HandWrittenTitle({ title = "Hand Written", subtitle }: HandWrittenTitleProps) {
  const reduce = useReducedMotion();
  const draw: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: {
      pathLength: 1,
      opacity: 1,
      transition: {
        pathLength: { duration: reduce ? 0 : 2.5, ease: [0.43, 0.13, 0.23, 0.96] },
        opacity: { duration: reduce ? 0 : 0.5 },
      },
    },
  };

  return (
    <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center py-8 text-center sm:py-12">
      {/* Title + its encircling loop, sized together so the circle wraps the text. */}
      <div className="relative inline-block px-6 py-7 sm:px-16 sm:py-9">
        <motion.svg
          className="pointer-events-none absolute inset-0 h-full w-full text-brand"
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
          initial="hidden"
          animate="visible"
          aria-hidden="true"
        >
          <motion.path
            d="M 1020 64
               C 1180 140, 1140 300, 600 332
               C 90 342, 40 286, 56 188
               C 56 78, 348 56, 628 60
               C 884 64, 1036 96, 1044 128"
            fill="none"
            strokeWidth={9}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            variants={draw}
            className="opacity-90"
          />
        </motion.svg>
        <motion.h1
          className="relative z-10 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: reduce ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.5, duration: reduce ? 0 : 0.8 }}
        >
          {title}
        </motion.h1>
      </div>
      {subtitle && (
        <motion.p
          className="mt-5 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1, duration: reduce ? 0 : 0.8 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export { HandWrittenTitle };
