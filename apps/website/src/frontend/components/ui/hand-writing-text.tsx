"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

interface HandWrittenTitleProps {
  title?: string;
  subtitle?: string;
}

/**
 * Hand-drawn circle that "writes" itself around a title on load. Stroke uses the
 * brand color; honours prefers-reduced-motion (draws instantly).
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
    <div className="relative mx-auto w-full max-w-4xl py-14 sm:py-20">
      <div className="pointer-events-none absolute inset-0">
        <motion.svg
          width="100%"
          height="100%"
          viewBox="0 0 1200 600"
          initial="hidden"
          animate="visible"
          className="h-full w-full"
        >
          <title>{title}</title>
          <motion.path
            d="M 950 90
               C 1250 300, 1050 480, 600 520
               C 250 520, 150 480, 150 300
               C 150 120, 350 80, 600 80
               C 850 80, 950 180, 950 180"
            fill="none"
            strokeWidth="10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={draw}
            className="text-brand opacity-90"
          />
        </motion.svg>
      </div>
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        <motion.h1
          className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl"
          initial={{ opacity: 0, y: reduce ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.5, duration: reduce ? 0 : 0.8 }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            className="mt-4 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 1, duration: reduce ? 0 : 0.8 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
    </div>
  );
}

export { HandWrittenTitle };
