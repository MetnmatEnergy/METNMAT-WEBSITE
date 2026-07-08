"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { cn } from "@/frontend/lib/utils";
import type { Project } from "@/frontend/lib/placeholder";

/**
 * Homepage projects carousel. Instead of a single spotlight, the section now
 * cross-fades through EVERY public project so a visitor sees the full breadth of
 * METNMAT's work without leaving the home page — and the "Explore projects" CTA
 * takes anyone interested straight to the full /projects index.
 *
 * Production notes:
 *  - Every slide stays in the DOM (CSS grid-stack) so all projects are crawlable
 *    and reachable by assistive tech; only the active slide is interactive.
 *  - Auto-advance pauses on hover/focus, when the tab is hidden, when the
 *    section scrolls out of view, and entirely under `prefers-reduced-motion`.
 *  - The fade is a plain CSS opacity transition (no layout thrash); the stage
 *    height is the tallest slide, so there is zero jump between projects.
 */

const AUTOPLAY_MS = 5500;

export function FeaturedProjectsCarousel({ projects }: { projects: Project[] }) {
  const count = projects.length;
  const [active, setActive] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (i: number) => setActive(((i % count) + count) % count),
    [count],
  );
  const next = useCallback(() => setActive((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setActive((i) => (i - 1 + count) % count), [count]);

  // Honour the OS "reduce motion" setting — no autoplay, instant switches.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Don't cycle while the section is off-screen (saves work, keeps the visible
  // slide predictable when the user scrolls back).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pause when the browser tab is backgrounded.
  useEffect(() => {
    const sync = () => setPageVisible(!document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const autoplaying =
    count > 1 && !hoverPaused && inView && pageVisible && !reduceMotion;

  // A per-slide timeout (keyed on `active`) rather than a fixed interval, so a
  // manual jump restarts the countdown and the advance stays in sync with the
  // progress bar (which also restarts on `active`).
  useEffect(() => {
    if (!autoplaying) return;
    const id = window.setTimeout(next, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [autoplaying, next, active]);

  if (count === 0) return null;

  const current = projects[active];

  return (
    <section
      className="section border-y border-border bg-surface/40"
      aria-roledescription="carousel"
      aria-label="Our projects"
    >
      <Container>
        {/* Section header — static; the slides carry the per-project detail. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="brand">Our Work</Badge>
            <h2 className="mt-4 max-w-xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Projects we&apos;ve delivered
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              A cross-section of METNMAT&apos;s R&amp;D — from high-conductivity copper
              alloys to thermoelectric waste-heat recovery, taken from lab to
              industrial scale.
            </p>
          </div>
          <Link
            href="/projects"
            className="group hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground/90 transition-colors hover:text-brand sm:inline-flex"
          >
            Explore all projects
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* Stage — all slides share one grid cell so its height is the tallest
            slide; slides cross-fade via opacity with no reflow. */}
        <div
          ref={stageRef}
          className="group/stage relative mt-10 grid grid-cols-1"
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
          onFocusCapture={() => setHoverPaused(true)}
          onBlurCapture={() => setHoverPaused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              next();
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              prev();
            }
          }}
          role="group"
          aria-label={`Project ${active + 1} of ${count}`}
        >
          {projects.map((project, i) => {
            const isActive = i === active;
            const href = `/projects/${project.slug}`;
            const highlights = (project.highlights ?? []).slice(0, 3);
            return (
              <article
                key={project.slug}
                className={cn(
                  "col-start-1 row-start-1 grid items-center gap-8 transition-opacity duration-700 ease-out motion-reduce:transition-none lg:grid-cols-2 lg:gap-12",
                  isActive ? "opacity-100" : "pointer-events-none opacity-0",
                )}
                aria-hidden={!isActive}
              >
                <Link
                  href={href}
                  tabIndex={isActive ? undefined : -1}
                  className="group/media block overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label={project.title}
                >
                  <MediaPlaceholder
                    className="aspect-[3/2] transition-transform duration-500 group-hover/media:scale-[1.02]"
                    src={project.coverUrl}
                    alt={project.coverAlt ?? project.title}
                    label={project.category || "Case study"}
                    sizes="(max-width: 1023px) 100vw, 50vw"
                    imageClassName="object-left"
                  />
                </Link>

                <div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-widest">
                    {project.category && (
                      <span className="text-brand-soft">{project.category}</span>
                    )}
                    <span className="text-muted-foreground">
                      {String(i + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                    <Link
                      href={href}
                      tabIndex={isActive ? undefined : -1}
                      className="transition-colors hover:text-brand"
                    >
                      {project.title}
                    </Link>
                  </h3>
                  <p className="mt-4 text-muted-foreground">{project.summary}</p>
                  {highlights.length > 0 && (
                    <ul className="mt-6 space-y-3 text-sm">
                      {highlights.map((h) => (
                        <li
                          key={`${h.label}-${h.value}`}
                          className="flex items-center gap-3 text-muted-foreground"
                        >
                          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                          <span>
                            <span className="font-medium text-foreground/90">{h.value}</span>{" "}
                            {h.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={href}
                    tabIndex={isActive ? undefined : -1}
                    className="group/link mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/90 transition-colors hover:text-brand"
                  >
                    View this case study
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Auto-advance progress — freezes when paused, hidden when static. */}
        {count > 1 && !reduceMotion && (
          <div className="mt-8 h-0.5 w-full overflow-hidden rounded-full bg-border" aria-hidden>
            <div
              key={active}
              className="h-full w-full origin-left bg-brand"
              style={{
                animationName: "carousel-progress",
                animationDuration: `${AUTOPLAY_MS}ms`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
                animationPlayState: autoplaying ? "running" : "paused",
              }}
            />
          </div>
        )}

        {/* Controls — prev · dots (jump to any project) · next · Explore CTA. */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous project"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {/* Compact counter on phones (15 dots are too small to hit); the
                jump-to-any dot strip appears from sm up where there's room. */}
            <span className="text-sm font-medium tabular-nums text-muted-foreground sm:hidden">
              <span className="text-foreground">{active + 1}</span> / {count}
            </span>
            <div className="hidden max-w-md flex-wrap items-center gap-1.5 sm:flex" role="tablist" aria-label="Choose a project">
              {projects.map((project, i) => (
                <button
                  key={project.slug}
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  aria-label={project.title}
                  onClick={() => goTo(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    active === i ? "w-8 bg-brand" : "w-1.5 bg-border hover:bg-brand/40",
                  )}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={next}
              aria-label="Next project"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* The primary redirect the brief asks for — always visible. */}
          <Button href="/projects">Explore projects</Button>
        </div>

        {/* Live region so screen-reader users hear which project is showing. */}
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          Showing{" "}
          <span className="font-medium text-foreground/80">{current.title}</span>
        </p>
      </Container>
    </section>
  );
}
