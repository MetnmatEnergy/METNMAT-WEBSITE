"use client";

import * as React from "react";
import VaporizeTextCycle, { Tag } from "@/frontend/components/ui/vapour-text-effect";
import type { Stat } from "@/frontend/lib/placeholder";

/**
 * Homepage hero stats. Shows 3 of the N stats at a time and slides the visible
 * window through all of them; both the number AND its label are rendered with
 * the vaporize canvas effect, on one shared clock so each pair dissolves/reforms
 * together. Degrades to a plain (SSR / no-JS / reduced-motion / phone) sliding
 * trio, and always exposes the full list to screen readers.
 */

const VISIBLE = 3;

// Number + label styling — shared by the canvas reference and the static fallback
// so the two stay visually aligned.
const NUMBER_CLASS =
  "font-display text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl lg:text-4xl";
const LABEL_CLASS = "text-xs leading-snug text-muted-foreground";
const NUM_STAGE = "h-8 sm:h-9 lg:h-11"; // fixed number height → no jump as particles fly
// Canvas slot keeps a fixed height so the <canvas> bitmap has a definite size.
const LABEL_STAGE = "mt-2 h-9";
// Static fallback (phones / reduced-motion / SSR): min-height, not a hard height,
// so a long label that wraps to 3 lines in a narrow phone column grows the box
// instead of clipping against the band's bottom border. Tops stay aligned.
const LABEL_STAGE_STATIC = "mt-2 min-h-[2.25rem]"; // 2.25rem === h-9

// Number + label vaporize on the SAME timing so, having mounted together, they
// advance in lockstep and a slot always shows the matching number↔label pair.
// (With the fast particle fade the cycle is time-gated, so identical config stays synced.)
const ANIM = { vaporizeDuration: 1, fadeInDuration: 1, waitDuration: 3.4 } as const;

type DisplayStyle = { color: string; fontFamily: string; fontSize: string; fontWeight: number };

const fontOf = (s: DisplayStyle) => ({ fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight });

/**
 * Reads the font + colour off a live element, so the canvas matches the CSS
 * exactly. Re-reads on resize (breakpoint change) and theme toggle (the site
 * swaps `.light` / `.dark` on <html>).
 */
function useDisplayStyle(ref: React.RefObject<HTMLElement | null>): DisplayStyle | null {
  const [style, setStyle] = React.useState<DisplayStyle | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = window.getComputedStyle(el);
      setStyle({
        color: cs.color,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: parseInt(cs.fontWeight) || 400,
      });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref]);

  return style;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

function VaporSlot({
  stats,
  slot,
  numStyle,
  labelStyle,
}: {
  stats: Stat[];
  slot: number;
  numStyle: DisplayStyle;
  labelStyle: DisplayStyle;
}) {
  const n = stats.length;
  // This slot cycles offset by its position; three slots offset by 0/1/2 with
  // identical timing show a sliding window of 3 distinct stats.
  const numbers = React.useMemo(() => Array.from({ length: n }, (_, k) => stats[(slot + k) % n].value), [stats, slot, n]);
  const labels = React.useMemo(() => Array.from({ length: n }, (_, k) => stats[(slot + k) % n].label), [stats, slot, n]);
  const numFont = React.useMemo(() => fontOf(numStyle), [numStyle]);
  const labelFont = React.useMemo(() => fontOf(labelStyle), [labelStyle]);

  return (
    <div className="flex flex-col">
      <div className={NUM_STAGE}>
        <VaporizeTextCycle
          texts={numbers}
          font={numFont}
          color={numStyle.color}
          alignment="left"
          direction="left-to-right"
          spread={2.5}
          density={5}
          animation={ANIM}
          tag={Tag.P}
        />
      </div>
      <div className={LABEL_STAGE}>
        <VaporizeTextCycle
          texts={labels}
          font={labelFont}
          color={labelStyle.color}
          alignment="left"
          direction="left-to-right"
          spread={2}
          density={5}
          animation={ANIM}
          tag={Tag.P}
        />
      </div>
    </div>
  );
}

function StaticSlot({ stats, slot, step }: { stats: Stat[]; slot: number; step: number }) {
  const n = stats.length;
  const s = stats[(slot + step) % n];
  return (
    <div className="flex flex-col">
      <div className={`flex items-center ${NUM_STAGE}`}>
        <span className={NUMBER_CLASS}>{s.value}</span>
      </div>
      <div className={LABEL_STAGE_STATIC}>
        <span className={LABEL_CLASS}>{s.label}</span>
      </div>
    </div>
  );
}

export function HeroStats({ stats }: { stats: Stat[] }) {
  const n = stats.length;
  const visible = Math.min(VISIBLE, n);
  const numRef = React.useRef<HTMLSpanElement | null>(null);
  const labelRef = React.useRef<HTMLSpanElement | null>(null);
  const numStyle = useDisplayStyle(numRef);
  const labelStyle = useDisplayStyle(labelRef);
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const small = useMediaQuery("(max-width: 639px)"); // phones: skip the canvas loops
  const [mounted, setMounted] = React.useState(false);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => setMounted(true), []);

  const useCanvas = mounted && !reduce && !small && n > visible;
  const cycleStatic = mounted && (reduce || small) && n > visible;

  React.useEffect(() => {
    if (!cycleStatic) return;
    const id = window.setInterval(() => setStep((k) => (k + 1) % n), 4000);
    return () => window.clearInterval(id);
  }, [cycleStatic, n]);

  return (
    <div className="relative mt-8 grid max-w-xl grid-cols-3 gap-x-4 border-t border-border pt-6 sm:gap-x-6 lg:mt-10">
      {/* Hidden references the canvases read their computed font + colour from. */}
      <span ref={numRef} aria-hidden className={`pointer-events-none absolute -z-10 opacity-0 ${NUMBER_CLASS}`}>
        0
      </span>
      <span ref={labelRef} aria-hidden className={`pointer-events-none absolute -z-10 opacity-0 ${LABEL_CLASS}`}>
        x
      </span>

      {Array.from({ length: visible }).map((_, i) =>
        useCanvas && numStyle && labelStyle ? (
          <VaporSlot key={i} stats={stats} slot={i} numStyle={numStyle} labelStyle={labelStyle} />
        ) : (
          <StaticSlot key={i} stats={stats} slot={i} step={cycleStatic ? step : 0} />
        ),
      )}

      {/* Full list for screen readers / SEO / no-JS — every stat, always present. */}
      <span className="sr-only">{stats.map((s) => `${s.value} ${s.label}. `).join("")}</span>
    </div>
  );
}
