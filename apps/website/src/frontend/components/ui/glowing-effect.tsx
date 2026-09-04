"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { cn } from "@/frontend/lib/utils";

/**
 * GlowingEffect — a border glow that follows the cursor along a card's edge.
 *
 * Adapted from the supplied Aceternity component to this codebase rather than
 * pasted: brand tokens instead of the stock rainbow so it reads as METNMAT in
 * both themes, and the listener discipline below, which the original does not
 * have.
 *
 * NOT the same thing as `ui/info-card.tsx`, which is kept. That one paints a
 * full conic border tracking the cursor's ANGLE around an image card. This
 * lights only the arc nearest the pointer and fades out past `proximity`, so a
 * grid of these reads as one surface responding to the cursor rather than eight
 * independent borders all lit at once.
 *
 * PERFORMANCE, deliberately. One passive `pointermove` on the window, coalesced
 * into a single rAF, and torn down on unmount — this site has already lost an
 * afternoon to a global listener that ran per-frame work on every event, so the
 * cheap version is the only version worth shipping. It also disables itself
 * entirely where it cannot mean anything: a coarse pointer has no hover, and
 * `prefers-reduced-motion` gets the value set instantly rather than animated.
 */

type GlowingEffectProps = {
  /** Softens the glow. 0 keeps the crisp edge the grid uses. */
  blur?: number;
  /** Fraction of the radius around the centre that counts as "not aimed at". */
  inactiveZone?: number;
  /** How far outside the card the pointer still lights it, in px. */
  proximity?: number;
  /** Arc width of the lit segment, in degrees. */
  spread?: number;
  glow?: boolean;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
  className?: string;
};

const GlowingEffectImpl = ({
  blur = 0,
  inactiveZone = 0.01,
  proximity = 0,
  spread = 20,
  glow = false,
  disabled = true,
  movementDuration = 2,
  borderWidth = 1,
  className,
}: GlowingEffectProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPosition = useRef({ x: 0, y: 0 });
  const frame = useRef(0);

  const handleMove = useCallback(
    (e?: { x: number; y: number }) => {
      const element = containerRef.current;
      if (!element) return;

      // Coalesce: several pointermove events in one frame do one measurement.
      if (frame.current) cancelAnimationFrame(frame.current);

      frame.current = requestAnimationFrame(() => {
        const { x, y } = e ?? lastPosition.current;
        if (e) lastPosition.current = { x, y };

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const inactiveRadius = 0.5 * Math.min(rect.width, rect.height) * inactiveZone;

        // Dead zone at the middle of the card: without it the angle spins
        // wildly as the pointer crosses the centre.
        if (Math.hypot(x - centerX, y - centerY) < inactiveRadius) {
          element.style.setProperty("--active", "0");
          return;
        }

        const isActive =
          x > rect.left - proximity &&
          x < rect.left + rect.width + proximity &&
          y > rect.top - proximity &&
          y < rect.top + rect.height + proximity;

        element.style.setProperty("--active", isActive ? "1" : "0");
        if (!isActive) return;

        const current = parseFloat(element.style.getPropertyValue("--start")) || 0;
        const target = (180 * Math.atan2(y - centerY, x - centerX)) / Math.PI + 90;

        // Take the short way round, so crossing 0/360 does not sweep the glow
        // the long way across the card.
        const delta = ((target - current + 180) % 360) - 180;
        const next = current + delta;

        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

        if (reduced) {
          element.style.setProperty("--start", String(next));
          return;
        }

        animate(current, next, {
          duration: movementDuration,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (value) => element.style.setProperty("--start", String(value)),
        });
      });
    },
    [inactiveZone, proximity, movementDuration],
  );

  useEffect(() => {
    if (disabled) return;
    // A coarse pointer has no hover, so this would only cost battery.
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) return;

    const onScroll = () => handleMove();
    const onPointerMove = (e: PointerEvent) => handleMove({ x: e.clientX, y: e.clientY });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [handleMove, disabled]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={
        {
          "--blur": `${blur}px`,
          "--spread": spread,
          "--start": "0",
          "--active": "0",
          "--glow-border-width": `${borderWidth}px`,
          // Brand-toned rather than the stock rainbow: the glow should read as
          // METNMAT red warming the edge, not as a demo gradient.
          "--gradient": `conic-gradient(from 236.84deg at 50% 50%,
            hsl(var(--brand)) 0deg,
            hsl(var(--brand) / 0.65) 60deg,
            hsl(var(--brand) / 0.25) 120deg,
            hsl(var(--brand) / 0.65) 240deg,
            hsl(var(--brand)) 360deg)`,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        blur > 0 && "blur-[var(--blur)]",
        glow && "opacity-100",
        disabled && "hidden",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit]",
          'after:absolute after:inset-[calc(-1*var(--glow-border-width))] after:rounded-[inherit] after:content-[""]',
          "after:[border:var(--glow-border-width)_solid_transparent]",
          "after:[background:var(--gradient)]",
          "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
          // Two masks intersected: keep only the border ring, and within it
          // only the arc near the pointer.
          "after:[mask-clip:padding-box,border-box] after:[mask-composite:intersect]",
          "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
        )}
      />
    </div>
  );
};

/** Memoised: a grid renders one per card and none of them take changing props. */
export const GlowingEffect = memo(GlowingEffectImpl);
GlowingEffect.displayName = "GlowingEffect";
