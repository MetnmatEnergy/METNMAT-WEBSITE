"use client";

import * as React from "react";
import Link from "next/link";
import HTMLFlipBook from "react-pageflip";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
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
 * Service flip-book — a real, draggable page-turn book (react-pageflip) styled
 * as aged paper. Drag a corner, click the page edges, use the Prev/Next or dot
 * controls, or the ← → keys. A cover + back cover bookend the service pages.
 *
 * Rendered client-only (behind a mount gate) with a static cover placeholder so
 * there's no layout shift and SSR stays clean; all service copy is also in the
 * showcase above for SEO/AT. Deep links from the showcase (/services#slug) open
 * the book to that page via the URL hash.
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

const PAPER = "radial-gradient(130% 120% at 0% 0%, #f6efdc 0%, #f1e8d0 45%, #e9dcbd 100%)";

export type BookPage = {
  slug: string;
  title: string;
  summary: string;
  icon?: string;
  href: string;
  cta?: string;
};

// Methods we call on the react-pageflip instance.
type PageFlipApi = {
  flipNext: () => void;
  flipPrev: () => void;
  turnToPage: (page: number) => void;
  getCurrentPageIndex: () => number;
  getPageCount: () => number;
};
type FlipBookRef = { pageFlip: () => PageFlipApi };

/** Shared binding shadow + edge treatment for every leaf. */
function PaperChrome() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/20 via-black/5 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_50px_rgba(80,60,20,0.12)]" />
    </>
  );
}

function CoverFace() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-r-md p-8 text-center" style={{ background: PAPER }}>
      <PaperChrome />
      <div className="pointer-events-none absolute inset-4 rounded-lg border border-brand/25" />
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/25">
        <BookOpen className="h-6 w-6" />
      </span>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.35em] text-black/45">METNMAT</p>
      <h3 className="mt-2 font-display text-3xl font-bold leading-tight text-[#2c2316]">
        Our Services
      </h3>
      <span aria-hidden className="mt-4 block h-px w-16 bg-brand/50" />
      <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-[#4a3f2c]">
        Customized, turnkey R&amp;D for metallurgy &amp; materials — from lab-scale prototype to full industrial scale.
      </p>
      <span className="mt-8 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
        <Sparkles className="h-3.5 w-3.5" /> Turn the page
      </span>
    </div>
  );
}

function ServiceFace({ page, n, total }: { page: BookPage; n: number; total: number }) {
  const Icon = (page.icon && ICONS[page.icon]) || FlaskConical;
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden p-7 sm:p-8" style={{ background: PAPER }}>
      <PaperChrome />
      <span aria-hidden className="absolute right-5 top-3 font-display text-6xl font-bold text-black/[0.06]">
        {String(n).padStart(2, "0")}
      </span>

      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-black/45">
        Service · {String(n).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>

      <span className="mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-brand ring-1 ring-brand/20">
        <Icon className="h-5 w-5" />
      </span>

      <h3 className="mt-4 max-w-[20ch] font-display text-2xl font-bold leading-tight text-[#2c2316]">
        {page.title}
      </h3>
      <span aria-hidden className="mt-3 block h-px w-14 bg-brand/50" />

      <p className="mt-3 text-[15px] leading-relaxed text-[#4a3f2c] [&::first-letter]:float-left [&::first-letter]:mr-2 [&::first-letter]:font-display [&::first-letter]:text-5xl [&::first-letter]:font-bold [&::first-letter]:leading-[0.8] [&::first-letter]:text-brand">
        {page.summary}
      </p>

      {/* Grounded meta band — same trust line that runs across the site. */}
      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-medium text-black/55">
        <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand" /> Lab → industrial scale</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand" /> Turnkey delivery</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-brand" /> GST invoice</li>
      </ul>

      <div className="mt-auto pt-5">
        <Link
          href={page.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand/80"
        >
          {page.cta ?? "Get a quote"}
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function BackFace() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-l-md p-8 text-center" style={{ background: PAPER }}>
      <PaperChrome />
      <div className="pointer-events-none absolute inset-4 rounded-lg border border-brand/25" />
      <h3 className="font-display text-2xl font-bold leading-tight text-[#2c2316]">
        Have a materials challenge?
      </h3>
      <span aria-hidden className="mt-4 block h-px w-16 bg-brand/50" />
      <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-[#4a3f2c]">
        Tell us your requirement and we&apos;ll scope it — from prototype to production.
      </p>
      <div className="mt-7 flex flex-col items-center gap-3">
        <Link href="/quote" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90">
          Request a quote <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link href="/contact" className="text-sm font-semibold text-brand hover:text-brand/80">
          or contact us →
        </Link>
      </div>
    </div>
  );
}

export function ServiceFlipbook({ pages }: { pages: BookPage[] }) {
  const total = pages.length;
  const leafCount = total + 2; // cover + services + back cover
  const [mounted, setMounted] = React.useState(false);
  const [page, setPage] = React.useState(0); // raw book-page index (0 = cover)
  const bookRef = React.useRef<FlipBookRef | null>(null);
  const liveRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  const api = () => bookRef.current?.pageFlip();
  const next = () => api()?.flipNext();
  const prev = () => api()?.flipPrev();
  const goToService = (i: number) => api()?.turnToPage(i + 1); // +1 for cover

  // Open to a service when the URL hash points at its slug (deep links).
  const applyHash = React.useCallback(() => {
    const slug = decodeURIComponent(location.hash.slice(1));
    const i = pages.findIndex((p) => p.slug === slug);
    if (i >= 0) api()?.turnToPage(i + 1);
  }, [pages]);

  React.useEffect(() => {
    if (!mounted) return;
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [mounted, applyHash]);

  React.useEffect(() => {
    const onService = page >= 1 && page <= total;
    const label = page === 0 ? "Cover" : page > total ? "Back cover" : `Service ${page} of ${total}: ${pages[page - 1].title}`;
    if (liveRef.current) liveRef.current.textContent = label;
    void onService;
  }, [page, total, pages]);

  const atStart = page <= 0;
  const atEnd = page >= leafCount - 1;
  const counter = page === 0 ? "Cover" : page > total ? "End" : `${String(page).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <div
      role="group"
      aria-roledescription="Flip book"
      aria-label="Services, one per page"
      className="mx-auto w-full max-w-[60rem]"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      }}
    >
      <div className="sr-only" aria-live="polite" ref={liveRef} />

      <div className="flex min-h-[28rem] items-center justify-center sm:min-h-[34rem]">
        {!mounted ? (
          // SSR / pre-hydration: a static cover so there's no layout shift.
          <div className="h-[26rem] w-[18rem] overflow-hidden rounded-r-md rounded-l-sm shadow-2xl ring-1 ring-black/15 sm:h-[32rem] sm:w-[22rem]">
            <CoverFace />
          </div>
        ) : (
          <HTMLFlipBook
            ref={bookRef}
            className="mm-flipbook"
            style={{ margin: "0 auto" }}
            width={400}
            height={560}
            size="stretch"
            minWidth={280}
            maxWidth={460}
            minHeight={400}
            maxHeight={680}
            startPage={0}
            drawShadow
            flippingTime={800}
            usePortrait
            startZIndex={5}
            autoSize
            maxShadowOpacity={0.5}
            showCover
            mobileScrollSupport
            clickEventForward
            useMouseEvents
            swipeDistance={30}
            showPageCorners
            disableFlipByClick={false}
            onFlip={(e: { data: number }) => setPage(e.data)}
            onInit={applyHash}
          >
            <div className="mm-leaf h-full w-full">
              <CoverFace />
            </div>
            {pages.map((p, i) => (
              <div className="mm-leaf h-full w-full" key={p.slug} id={p.slug}>
                <ServiceFace page={p} n={i + 1} total={total} />
              </div>
            ))}
            <div className="mm-leaf h-full w-full">
              <BackFace />
            </div>
          </HTMLFlipBook>
        )}
      </div>

      {/* Controls */}
      <div className="mt-7 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={prev}
          disabled={atStart}
          aria-label="Previous page"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-brand/50 hover:text-brand disabled:opacity-40"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2" aria-hidden>
          {pages.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => goToService(i)}
              tabIndex={-1}
              aria-label={`Go to ${p.title}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                page === i + 1 ? "w-6 bg-brand" : "w-1.5 bg-foreground/25 hover:bg-foreground/40"
              )}
            />
          ))}
        </div>

        <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-muted-foreground">
          {counter}
        </span>

        <button
          type="button"
          onClick={next}
          disabled={atEnd}
          aria-label="Next page"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-brand/50 hover:text-brand disabled:opacity-40"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
