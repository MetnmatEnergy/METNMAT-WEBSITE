"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/** The composed METNMAT shop banner (branding + product range + trust badges baked in). */
const BANNERS = [
  { src: "/site/shop-banner.webp", alt: "METNMAT Shop — electrochemical products, components & systems" },
];

const INTERVAL_MS = 6000;

/**
 * Premium banner showcase for the shop page: the composed product banners
 * crossfade on a clean white stage with prev/next arrows + dot navigation.
 * Autoplays, pauses on hover/focus, supports keyboard (← →) and respects
 * reduced motion (shows the first banner statically).
 */
export function ShopShowcase() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const count = BANNERS.length;

  const go = React.useCallback(
    (dir: 1 | -1) => setActive((a) => (a + dir + count) % count),
    [count]
  );

  React.useEffect(() => {
    if (paused || count < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % count), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, count]);

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Product showcase"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className="group/showcase relative overflow-hidden rounded-3xl border border-border bg-white shadow-sm ring-1 ring-black/[0.03]"
    >
      {/* aspect tuned to the banner artwork (~2.35:1), capped so it stays a banner on large screens */}
      <div className="relative aspect-[2/1] max-h-[460px] w-full sm:aspect-[2.35/1]">
        {BANNERS.map((b, i) => (
          <Image
            key={b.src}
            src={b.src}
            alt={b.alt}
            fill
            priority={i === 0}
            sizes="(max-width: 1280px) 100vw, 1200px"
            className={cn(
              "object-contain p-2 transition-opacity duration-700 sm:p-4",
              i === active ? "opacity-100" : "opacity-0"
            )}
          />
        ))}
      </div>

      {/* Prev / next — always visible on touch, fade in on hover for desktop */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md ring-1 ring-black/5 transition-all hover:bg-white hover:text-brand focus-visible:opacity-100 sm:left-3 sm:opacity-0 sm:group-hover/showcase:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md ring-1 ring-black/5 transition-all hover:bg-white hover:text-brand focus-visible:opacity-100 sm:right-3 sm:opacity-0 sm:group-hover/showcase:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dots — small visual, generous tap target via padding */}
      {count > 1 && (
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show banner ${i + 1}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className="flex items-center justify-center p-2"
            >
              <span
                className={cn(
                  "block h-2 rounded-full transition-all",
                  i === active ? "w-6 bg-brand" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
