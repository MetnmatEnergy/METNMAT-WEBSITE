"use client";

import React, { useEffect, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/frontend/lib/utils";
import { createPointerBroadcaster } from "@/frontend/lib/pointer-glow";

type GlowColor = "blue" | "purple" | "green" | "red" | "orange" | "brand";

/** Bridges the broadcaster's (x, y) callback to the DOM PointerEvent listener
 *  it was actually registered with, so removal matches by reference. */
const handlers = new WeakMap<(x: number, y: number) => void, (e: PointerEvent) => void>();

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
}

/**
 * ONE pointer listener for every card on the page.
 *
 * Each card used to add its own `pointermove` listener to `document` and write
 * four CSS custom properties onto itself. The values are viewport coordinates,
 * identical for every card, so the shop page — ten cards — bound ten listeners
 * and performed forty style writes per pointermove, each invalidating a card
 * that paints a radial gradient with `background-attachment: fixed`.
 *
 * The properties now go on the document element, once per animation frame.
 * They inherit, and globals.css reads them as `var(--x, 0)` on [data-glow]
 * without setting them locally, so each card resolves the same value it held
 * before. Identical pixels, one listener, four writes per frame.
 */
const pointerGlow = createPointerBroadcaster({
  addListener: (fn) => {
    const handler = (e: PointerEvent) => fn(e.clientX, e.clientY);
    handlers.set(fn, handler);
    document.addEventListener("pointermove", handler, { passive: true });
  },
  removeListener: (fn) => {
    const handler = handlers.get(fn);
    if (handler) {
      document.removeEventListener("pointermove", handler);
      handlers.delete(fn);
    }
  },
  schedule: (fn) => requestAnimationFrame(fn),
  cancel: (h) => cancelAnimationFrame(h),
  apply: (vars) => {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
  },
  viewport: () => ({ w: window.innerWidth, h: window.innerHeight }),
});

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
  // Join the shared pointer tracker; the listener exists while at least one
  // card is mounted and is removed with the last of them.
  useEffect(() => pointerGlow.subscribe(), []);

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
    // The upstream component set `touch-action: none` here because it had a
    // drag gesture. This card has none, and on the shop page it sits on ten
    // large tiles. That value tells the browser not to pan, so a visitor who
    // began a swipe on a category card could not scroll the page. Removed.
    // The spotlight is driven by pointermove and is unaffected.
  } as CSSProperties;

  return (
    <div data-glow style={style} className={cn("rounded-2xl", className)}>
      <div data-glow />
      {children}
    </div>
  );
}

export { GlowCard as SpotlightCard };
