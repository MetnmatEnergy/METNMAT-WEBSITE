"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FlaskConical,
  Rocket,
  Lightbulb,
  Gauge,
  Target,
  Flame,
  Cpu,
  Microscope,
  Factory,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Expanding cards — an accessible, theme-aware "expand on hover" gallery.
 *
 * Desktop (lg+): a horizontal row where the active card grows and the rest
 * collapse to a slim strip with a vertical label. Active follows hover AND
 * keyboard focus, so it works without a mouse. Below lg it degrades to a
 * stacked column of full cards (no hover dependency — good for touch).
 *
 * Each card is a real <Link>, so it's focusable and navigable. Images are
 * decorative with a brand-gradient fallback (onError), so a missing/blocked
 * image never shows a broken card.
 */

const ICONS: Record<string, LucideIcon> = {
  rocket: Rocket,
  lightbulb: Lightbulb,
  gauge: Gauge,
  target: Target,
  flame: Flame,
  cpu: Cpu,
  microscope: Microscope,
  factory: Factory,
};

// Warm, industrial brand-tinted fallbacks (used until/if the photo loads).
const GRADIENTS = [
  "linear-gradient(135deg,#d81f26,#5c0f13)",
  "linear-gradient(135deg,#e0561f,#5c220c)",
  "linear-gradient(135deg,#b21430,#3f0a16)",
  "linear-gradient(135deg,#c2410c,#451c07)",
  "linear-gradient(135deg,#9f1d2b,#2c080c)",
  "linear-gradient(135deg,#92400e,#3a1a06)",
  "linear-gradient(135deg,#a8431a,#3a1206)",
  "linear-gradient(135deg,#7f1d2e,#290910)",
];

export type ExpandCard = {
  title: string;
  summary: string;
  href: string;
  /** Lucide icon key (rocket/lightbulb/gauge/target/flame/cpu). */
  icon?: string;
  /** Background photo URL (optional — falls back to a brand gradient). */
  image?: string;
};

function CardMedia({ image, index }: { image?: string; index: number }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <>
      {/* Brand gradient — always present, so there's never a blank/broken card. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: GRADIENTS[index % GRADIENTS.length] }}
      />
      {image && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          aria-hidden
          loading={index === 0 ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Legibility scrim for the white text. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10"
      />
    </>
  );
}

export function ExpandingCards({
  items,
  className,
}: {
  items: ExpandCard[];
  className?: string;
}) {
  const [active, setActive] = React.useState(0);

  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:gap-2.5", className)}>
      {items.map((item, idx) => {
        const Icon = (item.icon && ICONS[item.icon]) || FlaskConical;
        const isActive = idx === active;
        return (
          <Link
            key={`${item.href}-${idx}`}
            href={item.href}
            onMouseEnter={() => setActive(idx)}
            onFocus={() => setActive(idx)}
            className={cn(
              "group/card relative flex h-60 shrink-0 overflow-hidden rounded-3xl border border-border/60 outline-none",
              "transition-all duration-500 ease-in-out motion-reduce:transition-none",
              "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              // Mobile: full-width stacked cards. Desktop: expand/collapse.
              "w-full lg:h-[26rem] lg:w-auto lg:min-w-[4.5rem]",
              isActive ? "lg:flex-[6]" : "lg:flex-[1]",
              isActive && "lg:border-brand/50"
            )}
          >
            <CardMedia image={item.image} index={idx} />

            {/* Icon — top-left, always visible. */}
            <span className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </span>

            {/* Collapsed vertical label (desktop only, decorative — the h3 below
                carries the real title for assistive tech). */}
            <span
              aria-hidden
              className={cn(
                "absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 rotate-180 whitespace-nowrap text-sm font-semibold tracking-wide text-white/90 [writing-mode:vertical-rl]",
                !isActive && "lg:block"
              )}
            >
              {item.title}
            </span>

            {/* Expanded content (and the default on mobile). */}
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 z-10 p-6 transition-opacity duration-300 motion-reduce:transition-none",
                isActive ? "opacity-100" : "opacity-100 lg:pointer-events-none lg:opacity-0"
              )}
            >
              <h3 className="font-display text-xl font-bold leading-tight text-white">
                {item.title}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
                {item.summary}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                Learn more
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5" />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
