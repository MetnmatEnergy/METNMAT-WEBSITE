"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform } from "framer-motion";
import {
  Rocket,
  Lightbulb,
  Gauge,
  Target,
  Flame,
  Cpu,
  Microscope,
  Factory,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Draggable service card stack — adapted from the provided 21st.dev CardStack
 * to this codebase: the demo's full-screen chrome (theme toggle, shuffle,
 * animated grid background) is dropped; the section keeps the core mechanic —
 * drag the front card up/down (or use the controls/dots) to cycle the deck.
 * Every card stays in the DOM for SEO/AT, and /services#slug deep links spin
 * the matching card to the front.
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

const DELIVERY_POINTS = ["Lab → industrial scale", "Turnkey delivery", "GST invoice"] as const;

export type ServiceStackItem = {
  slug: string;
  title: string;
  summary: string;
  icon?: string;
  href: string;
  cta?: string;
  image?: string;
};

const OFFSET_PERCENT = 4.5; // vertical peek of the cards behind
const SCALE_STEP = 0.05;
const DIM_STEP = 0.14;
const SWIPE_THRESHOLD = 50;
const VISIBLE_DEPTH = 4; // cards actually painted behind the front one

const spring = { type: "spring" as const, stiffness: 170, damping: 26 };

export function ServiceCardStack({ items }: { items: ServiceStackItem[] }) {
  // The deck is an ordering of item indices; the first entry is the front card.
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i));
  const [leaving, setLeaving] = useState(false);
  // Touch devices keep native page scrolling — a full-width y-drag card would
  // trap vertical swipes. Phones cycle via the arrows/dots instead.
  const [coarsePointer, setCoarsePointer] = useState(false);
  const wasDragged = useRef(false);

  useEffect(() => {
    setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const dragY = useMotionValue(0);
  const rotateX = useTransform(dragY, [-200, 0, 200], [12, 0, -12]);

  const next = () =>
    setOrder((prev) => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));
  const prev = () =>
    setOrder((p) => (p.length > 1 ? [p[p.length - 1], ...p.slice(0, -1)] : p));
  const jumpTo = (itemIdx: number) =>
    setOrder(() => {
      const base = items.map((_, i) => i);
      return [...base.slice(itemIdx), ...base.slice(0, itemIdx)];
    });

  // Deep links (/services#slug) bring that service to the front.
  useEffect(() => {
    const applyHash = () => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      if (!slug) return;
      const idx = items.findIndex((s) => s.slug === slug);
      if (idx >= 0) jumpTo(idx);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const cycle = (direction: "next" | "prev") => {
    setLeaving(true);
    window.setTimeout(() => {
      (direction === "next" ? next : prev)();
      setLeaving(false);
    }, 140);
  };

  const handleDragEnd = (
    _: unknown,
    info: { offset: { y: number }; velocity: { y: number } },
  ) => {
    window.setTimeout(() => {
      wasDragged.current = false;
    }, 0);
    if (Math.abs(info.offset.y) > SWIPE_THRESHOLD || Math.abs(info.velocity.y) > 500) {
      cycle(info.offset.y < 0 || info.velocity.y < 0 ? "next" : "prev");
    }
    dragY.set(0);
  };

  const frontItem = items[order[0]];

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Breathing room for the stacked cards peeking above the front card. */}
      <div className="relative mt-6 aspect-[16/11] w-full sm:aspect-[16/9]">
        <ul className="relative m-0 h-full w-full list-none p-0">
          {order.map((itemIdx, i) => {
            const s = items[itemIdx];
            const isFront = i === 0;
            const draggable = isFront && !coarsePointer;
            const hidden = i > VISIBLE_DEPTH;
            const Icon = (s.icon && ICONS[s.icon]) || Rocket;
            const number = String(itemIdx + 1).padStart(2, "0");

            return (
              <motion.li
                key={s.slug}
                id={s.slug}
                className="absolute h-full w-full scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-surface"
                style={{
                  cursor: draggable ? "grab" : "auto",
                  touchAction: coarsePointer ? "auto" : "pan-x",
                  boxShadow: isFront
                    ? "0 25px 50px rgba(0,0,0,0.35)"
                    : "0 15px 30px rgba(0,0,0,0.18)",
                  rotateX: isFront ? rotateX : 0,
                  transformPerspective: 1000,
                }}
                animate={{
                  top: `${i * -OFFSET_PERCENT}%`,
                  scale: 1 - i * SCALE_STEP,
                  filter: `brightness(${Math.max(0.35, 1 - i * DIM_STEP)})`,
                  zIndex: items.length - i,
                  opacity: hidden ? 0 : leaving && isFront ? 0 : 1,
                }}
                transition={spring}
                drag={draggable ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.7}
                onDragStart={() => {
                  wasDragged.current = true;
                }}
                onDrag={(_, info) => {
                  if (draggable) dragY.set(info.offset.y);
                }}
                onDragEnd={draggable ? handleDragEnd : undefined}
                whileDrag={draggable ? { zIndex: items.length + 1, cursor: "grabbing", scale: 1.03 } : {}}
                aria-hidden={!isFront}
              >
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image}
                    alt=""
                    aria-hidden
                    loading={i < 2 ? "eager" : "lazy"}
                    draggable={false}
                    className="pointer-events-none h-full w-full select-none object-cover"
                  />
                ) : (
                  <div aria-hidden className="h-full w-full bg-gradient-to-br from-brand/30 via-surface to-surface" />
                )}
                {/* Legibility gradient + service copy (photo cards read white in both themes). */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-semibold tracking-widest text-white/90 backdrop-blur-sm">
                    {number} / {String(items.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                  <h3 className="font-display text-lg font-semibold leading-snug text-white sm:text-2xl">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-white/80 sm:mt-2 sm:text-sm">
                    {s.summary}
                  </p>
                  <ul className="mt-2.5 hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/70 sm:flex">
                    {DELIVERY_POINTS.map((d) => (
                      <li key={d} className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="h-1 w-1 rounded-full bg-brand-soft" /> {d}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={s.href}
                    onClick={(e) => {
                      if (wasDragged.current) e.preventDefault();
                    }}
                    tabIndex={isFront ? 0 : -1}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground shadow-md shadow-black/20 transition-colors hover:bg-brand/90 sm:mt-4 sm:text-sm"
                  >
                    {s.cta ?? "Get a quote"}
                  </Link>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>

      {/* Controls — previous / dots / counter / next. */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => cycle("prev")}
          aria-label="Previous service"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Services">
          {items.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              role="tab"
              aria-selected={order[0] === i}
              aria-label={s.title}
              onClick={() => jumpTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                order[0] === i ? "w-8 bg-brand" : "w-1.5 bg-border hover:bg-brand/40",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => cycle("next")}
          aria-label="Next service"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {coarsePointer ? "Use the arrows or dots to browse." : "Drag the card up or down — or use the arrows and dots."}{" "}
        Showing <span className="font-medium text-foreground/80">{frontItem?.title}</span>
      </p>
    </div>
  );
}
