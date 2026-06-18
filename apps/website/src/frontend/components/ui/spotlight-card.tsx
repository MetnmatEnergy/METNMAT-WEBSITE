"use client";

import React, { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/frontend/lib/utils";

type GlowColor = "blue" | "purple" | "green" | "red" | "orange" | "brand";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
}

const glowColorMap: Record<GlowColor, { base: number; spread: number }> = {
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
  // METNMAT brand red — tight spread so the spotlight stays crimson/ember on-brand.
  brand: { base: 355, spread: 45 },
};

/**
 * Spotlight / glow card. A pointer-tracked radial spotlight lights the card's
 * border + surface (the border glow CSS lives in globals.css under [data-glow]).
 * Theme-aware (surface/border tokens) and brand-tinted by default.
 */
export function GlowCard({ children, className = "", glowColor = "brand" }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const syncPointer = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;
      card.style.setProperty("--x", x.toFixed(2));
      card.style.setProperty("--xp", (x / window.innerWidth).toFixed(2));
      card.style.setProperty("--y", y.toFixed(2));
      card.style.setProperty("--yp", (y / window.innerHeight).toFixed(2));
    };
    document.addEventListener("pointermove", syncPointer, { passive: true });
    return () => document.removeEventListener("pointermove", syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];

  const style = {
    "--base": base,
    "--spread": spread,
    // Renamed from the source's --radius/--border to avoid clobbering the theme
    // tokens of the same name on child elements.
    "--glow-radius": "16",
    "--glow-border": "2",
    "--backdrop": "hsl(var(--surface))",
    "--backup-border": "hsl(var(--border))",
    "--size": "200",
    "--outer": "1",
    "--border-size": "calc(var(--glow-border, 2) * 1px)",
    "--spotlight-size": "calc(var(--size, 200) * 1px)",
    "--hue": "calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))",
    backgroundImage: `radial-gradient(
      var(--spotlight-size) var(--spotlight-size) at
      calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px),
      hsl(var(--hue, 357) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 55) * 1%) / var(--bg-spot-opacity, 0.12)), transparent
    )`,
    backgroundColor: "var(--backdrop)",
    backgroundSize: "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
    backgroundPosition: "50% 50%",
    backgroundAttachment: "fixed",
    border: "var(--border-size) solid var(--backup-border)",
    position: "relative",
    touchAction: "none",
  } as CSSProperties;

  return (
    <div ref={cardRef} data-glow style={style} className={cn("rounded-2xl", className)}>
      <div data-glow />
      {children}
    </div>
  );
}

export { GlowCard as SpotlightCard };
