"use client";

import * as React from "react";
import VaporizeTextCycle, { Tag } from "@/frontend/components/ui/vapour-text-effect";
import type { Stat } from "@/frontend/lib/placeholder";

/**
 * Homepage hero stats. Shows 3 of the N stats at a time and slides the visible
 * window through all of them, with each number rendered as the vaporize canvas
 * effect. Degrades to a plain (SSR / no-JS / reduced-motion) sliding trio, and
 * always exposes the full list to screen readers.
 */

const VISIBLE = 3;

// Number + label styling, shared by the canvas reference and the static fallback
// so the two are pixel-identical.
const NUMBER_CLASS =
  "font-display text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl lg:text-4xl";
const LABEL_CLASS = "mt-2 text-xs leading-snug text-muted-foreground";
const STAGE_CLASS = "h-8 sm:h-9 lg:h-11"; // fixed number height → no jump as particles fly

type DisplayStyle = { color: string; fontFamily: string; fontSize: string; fontWeight: number };

/**
 * Reads the display font + foreground colour off a live element, so the canvas
 * matches the CSS exactly. Re-reads on resize (breakpoint change) and on theme
 * toggle (the site swaps `.light` / `.dark` on <html>).
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
        fontWeight: parseInt(cs.fontWeight) || 700,
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

function VaporSlot({ stats, slot, style }: { stats: Stat[]; slot: number; style: DisplayStyle }) {
  const n = stats.length;
  const [idx, setIdx] = React.useState(0);
  // This slot cycles the numbers offset by its position; three slots offset by
  // 0/1/2 with identical timing therefore show a sliding window of 3 distinct stats.
  const numbers = React.useMemo(
    () => Array.from({ length: n }, (_, k) => stats[(slot + k) % n].value),
    [stats, slot, n],
  );
  const fontProp = React.useMemo(
    () => ({ fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight }),
    [style.fontFamily, style.fontSize, style.fontWeight],
  );
  const label = stats[(slot + idx) % n].label;

  return (
    <div className="flex flex-col">
      <div className={STAGE_CLASS}>
        <VaporizeTextCycle
          texts={numbers}
          font={fontProp}
          color={style.color}
          alignment="left"
          direction="left-to-right"
          spread={2.5}
          density={5}
          // Number stays solid & readable most of the cycle (long wait), then a
          // brief, gentle dissolve + smooth reform — pleasant, not a lingering scatter.
          animation={{ vaporizeDuration: 1, fadeInDuration: 1, waitDuration: 3.4 }}
          onTextChange={setIdx}
          tag={Tag.P}
        />
      </div>
      <span className={LABEL_CLASS}>{label}</span>
    </div>
  );
}

function StaticSlot({ stats, slot, step }: { stats: Stat[]; slot: number; step: number }) {
  const n = stats.length;
  const s = stats[(slot + step) % n];
  return (
    <div className="flex flex-col">
      <div className={`flex items-center ${STAGE_CLASS}`}>
        <span className={NUMBER_CLASS}>{s.value}</span>
      </div>
      <span className={LABEL_CLASS}>{s.label}</span>
    </div>
  );
}

export function HeroStats({ stats }: { stats: Stat[] }) {
  const n = stats.length;
  const visible = Math.min(VISIBLE, n);
  const refEl = React.useRef<HTMLSpanElement | null>(null);
  const style = useDisplayStyle(refEl);
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const small = useMediaQuery("(max-width: 639px)"); // phones: skip 3 canvas loops
  const [mounted, setMounted] = React.useState(false);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => setMounted(true), []);

  // Canvas path: each slot self-cycles. Lightweight path (reduced motion or small
  // screens): advance a shared step so all 5 still cycle via an instant swap —
  // nobody loses the two extra numbers, and phones don't run 3 canvas loops.
  const useCanvas = mounted && !reduce && !small && n > visible;
  const cycleStatic = mounted && (reduce || small) && n > visible;

  React.useEffect(() => {
    if (!cycleStatic) return;
    const id = window.setInterval(() => setStep((k) => (k + 1) % n), 4000);
    return () => window.clearInterval(id);
  }, [cycleStatic, n]);

  return (
    <div className="relative mt-8 grid max-w-xl grid-cols-3 gap-x-4 border-t border-border pt-6 sm:gap-x-6 lg:mt-10">
      {/* Hidden reference the canvas reads its computed font + colour from. */}
      <span ref={refEl} aria-hidden className={`pointer-events-none absolute -z-10 opacity-0 ${NUMBER_CLASS}`}>
        0
      </span>

      {Array.from({ length: visible }).map((_, i) =>
        useCanvas && style ? (
          <VaporSlot key={i} stats={stats} slot={i} style={style} />
        ) : (
          <StaticSlot key={i} stats={stats} slot={i} step={cycleStatic ? step : 0} />
        ),
      )}

      {/* Full list for screen readers / SEO / no-JS — every stat, always present. */}
      <span className="sr-only">{stats.map((s) => `${s.value} ${s.label}. `).join("")}</span>
    </div>
  );
}
