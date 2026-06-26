"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
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
 * Service flip-book — an aged-paper book where each service is a leaf hinged at
 * the spine. Click the page (or the side arrows / ← → keys) to turn it. All
 * leaves stay in the DOM (each carries id={slug}) so deep links from the
 * showcase still resolve and the book opens to the matching page via the hash.
 *
 * Accessible: real buttons drive navigation, an aria-live region announces the
 * current page, and prefers-reduced-motion turns instantly. The page-click is a
 * progressive enhancement on top of the buttons/keys.
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

export type BookPage = {
  slug: string;
  title: string;
  summary: string;
  icon?: string;
  href: string;
  cta?: string;
};

const PAPER =
  "radial-gradient(130% 120% at 0% 0%, #f6efdc 0%, #f1e8d0 45%, #e9dcbd 100%)";

function PageFace({ page, n, total, active }: { page: BookPage; n: number; total: number; active: boolean }) {
  const Icon = (page.icon && ICONS[page.icon]) || FlaskConical;
  return (
    <div className="relative flex h-full flex-col p-7 sm:p-10" style={{ background: PAPER }}>
      {/* Binding shadow at the spine + soft outer edges. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-black/20 via-black/5 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(80,60,20,0.12)]" />
      {/* Page number watermark. */}
      <span aria-hidden className="absolute right-6 top-4 font-display text-6xl font-bold text-black/[0.06] sm:text-7xl">
        {String(n).padStart(2, "0")}
      </span>

      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/45">
        Service · {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>

      <span className="mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/20">
        <Icon className="h-5 w-5" />
      </span>

      <h3 className="mt-5 max-w-[22ch] font-display text-2xl font-bold leading-tight text-[#2c2316] sm:text-3xl">
        {page.title}
      </h3>
      <span aria-hidden className="mt-4 block h-px w-16 bg-brand/50" />

      <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-[#4a3f2c] [&::first-letter]:float-left [&::first-letter]:mr-2 [&::first-letter]:font-display [&::first-letter]:text-5xl [&::first-letter]:font-bold [&::first-letter]:leading-[0.8] [&::first-letter]:text-brand">
        {page.summary}
      </p>

      <div className="mt-auto pt-6">
        <Link
          href={page.href}
          tabIndex={active ? undefined : -1}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand/80"
        >
          {page.cta ?? "Get a quote"}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function ServiceFlipbook({ pages }: { pages: BookPage[] }) {
  const total = pages.length;
  const [index, setIndex] = React.useState(0);
  const [turning, setTurning] = React.useState<number | null>(null);
  const [instant, setInstant] = React.useState(false);
  const liveRef = React.useRef<HTMLDivElement>(null);

  const atStart = index <= 0;
  const atEnd = index >= total - 1;

  const flip = (dir: "next" | "prev") => {
    if (turning !== null) return; // ignore input mid-turn
    const to = dir === "next" ? index + 1 : index - 1;
    if (to < 0 || to >= total) return;
    // The animating leaf is the current page (next) or the incoming page (prev).
    setTurning(dir === "next" ? index : to);
    setIndex(to);
  };

  // Jump straight to a page (no flip) — used for deep links via the URL hash.
  const jumpTo = React.useCallback((i: number) => {
    setInstant(true);
    setIndex(i);
    requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
  }, []);

  React.useEffect(() => {
    const sync = () => {
      const slug = decodeURIComponent(location.hash.slice(1));
      const i = pages.findIndex((p) => p.slug === slug);
      if (i >= 0) jumpTo(i);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pages, jumpTo]);

  React.useEffect(() => {
    if (liveRef.current) liveRef.current.textContent = `Service ${index + 1} of ${total}: ${pages[index].title}`;
  }, [index, total, pages]);

  return (
    <div
      role="group"
      aria-roledescription="Flip book"
      aria-label="Services, one per page"
      className="mx-auto w-full max-w-2xl"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); if (!atEnd) flip("next"); }
        if (e.key === "ArrowLeft") { e.preventDefault(); if (!atStart) flip("prev"); }
      }}
    >
      <div className="sr-only" aria-live="polite" ref={liveRef} />

      {/* The book */}
      <div className="relative [perspective:2400px]">
        <div className="relative h-[27rem] w-full overflow-hidden rounded-l-md rounded-r-2xl shadow-2xl ring-1 ring-black/15 sm:h-[24rem]">
          {pages.map((page, i) => {
            const turned = i < index;
            const z = i === turning ? 60 : i >= index ? total - i : i;
            return (
              <div
                key={page.slug}
                id={page.slug}
                onTransitionEnd={(e) => {
                  if (e.propertyName === "transform" && i === turning) setTurning(null);
                }}
                onClick={() => { if (!atEnd) flip("next"); }}
                style={{ transform: `rotateY(${turned ? -180 : 0}deg)`, zIndex: z }}
                aria-hidden={i !== index}
                className={cn(
                  "absolute inset-0 origin-left cursor-pointer select-none [transform-style:preserve-3d]",
                  !instant && "transition-transform duration-700 ease-[cubic-bezier(.4,.12,.2,1)] motion-reduce:!transition-none"
                )}
              >
                {/* Front (content) */}
                <div className="absolute inset-0 overflow-hidden rounded-l-md rounded-r-2xl [backface-visibility:hidden]">
                  <PageFace page={page} n={i + 1} total={total} active={i === index} />
                  {/* Turning shade — darkens the leaf as it lifts, for depth. */}
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-0 bg-black transition-opacity duration-700",
                      i === turning ? "opacity-25" : "opacity-0"
                    )}
                  />
                </div>
                {/* Back (blank aged paper) */}
                <div
                  className="absolute inset-0 overflow-hidden rounded-l-md rounded-r-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  style={{ background: PAPER }}
                >
                  <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-black/20 to-transparent" />
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-7xl font-bold text-black/[0.05]">
                    M
                  </span>
                </div>
              </div>
            );
          })}

          {/* Side turn affordances (overlay the book edges). */}
          <button
            type="button"
            onClick={() => flip("prev")}
            disabled={atStart || turning !== null}
            aria-label="Previous service"
            tabIndex={-1}
            className="absolute left-2 top-1/2 z-[70] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => flip("next")}
            disabled={atEnd || turning !== null}
            aria-label="Next service"
            tabIndex={-1}
            className="absolute right-2 top-1/2 z-[70] hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/50 disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={() => flip("prev")}
          disabled={atStart || turning !== null}
          aria-label="Previous service"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-brand/50 hover:text-brand disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2" aria-hidden>
          {pages.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => jumpTo(i)}
              tabIndex={-1}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-brand" : "w-1.5 bg-foreground/25 hover:bg-foreground/40"
              )}
            />
          ))}
        </div>

        <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>

        <button
          type="button"
          onClick={() => flip("next")}
          disabled={atEnd || turning !== null}
          aria-label="Next service"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-brand/50 hover:text-brand disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
