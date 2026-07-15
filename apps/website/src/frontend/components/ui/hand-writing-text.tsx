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
        {/* The hero h1 is the page's LCP element. `initial={false}` renders it at
            its final (visible) state in the SSR HTML — so it paints instantly and
            stays visible with JS disabled — instead of shipping opacity:0 and only
            revealing after hydration + a 1.3s delay. The decorative circle above
            still draws itself in. */}
        <motion.h1
          className="relative z-10 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl"
          initial={false}
        >
          {title}
        </motion.h1>
      </div>
      {subtitle && (
        // Real hero copy — render it visible in the SSR HTML (no-JS resilient,
        // no hydration-gated reveal) rather than starting at opacity:0.
        <motion.p
          className="mt-5 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg"
          initial={false}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export { HandWrittenTitle };
