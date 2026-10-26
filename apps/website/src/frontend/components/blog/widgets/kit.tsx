"use client";

/**
 * Building blocks shared by the blog's interactive models: a measured chart
 * width (so SVG text is drawn at true pixel size on a phone), labelled range
 * sliders, axes and the colour palette.
 *
 * Colours come from CSS variables (--viz-1…8 in globals.css, redefined under
 * .dark), so a model follows the site theme without re-rendering. Lines past
 * the eighth also get a dash pattern; colour is never the only cue.
 */
import React from "react";
import { cn } from "@/frontend/lib/utils";
import { decadeTicks, pow10, tickLabel } from "@/frontend/lib/widgets/chart-math";

export const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--viz-${i + 1})`);
export const DASHES = [undefined, "7 4", "2 3", "9 3 2 3"] as const;
export const seriesStyle = (i: number) => ({
  stroke: PALETTE[i % PALETTE.length]!,
  dash: DASHES[Math.floor(i / PALETTE.length) % DASHES.length],
});

export const FG = "hsl(var(--foreground))";
export const MUTED = "hsl(var(--muted-foreground))";
export const GRID = "hsl(var(--border))";
export const BRAND = "hsl(var(--brand))";
export const BG = "hsl(var(--surface))";

/** The chart's rendered width. Starts at `initial` on the server and the first client render, then measures. */
export function useWidth<T extends HTMLElement>(initial = 640): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(initial);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Plot box inside an SVG of the given width. */
export function layout(width: number, opts: { right?: number; left?: number; aspect?: number; minH?: number; maxH?: number } = {}) {
  const narrow = width < 480;
  const margin = { top: 16, right: opts.right ?? (narrow ? 12 : 20), bottom: 46, left: opts.left ?? (narrow ? 50 : 58) };
  const height = Math.round(Math.min(opts.maxH ?? 520, Math.max(opts.minH ?? 280, width * (opts.aspect ?? 0.68))));
  return {
    width,
    height,
    margin,
    narrow,
    x0: margin.left,
    x1: width - margin.right,
    y0: margin.top,
    y1: height - margin.bottom,
  };
}
export type Box = ReturnType<typeof layout>;

export function Svg({ box, label, children, className }: { box: Box; label: string; children: React.ReactNode; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${box.width} ${box.height}`}
      width="100%"
      className={cn("block h-auto select-none overflow-visible", className)}
      style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
    >
      {children}
    </svg>
  );
}

type Tick = { v: number; label: string };

export function linearTicks(ticks: number[]): Tick[] {
  return ticks.map((v) => ({ v, label: tickLabel(v) }));
}
export function logTicks(log10Min: number, log10Max: number, max = 6): Tick[] {
  return decadeTicks(log10Min, log10Max, max).map((e) => ({ v: e, label: pow10(e) }));
}

/** Bottom axis with grid lines. `x` maps a tick value to pixels. */
export function AxisBottom({ box, ticks, x, label }: { box: Box; ticks: Tick[]; x: (v: number) => number; label: string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t.v} transform={`translate(${x(t.v)},0)`}>
          <line y1={box.y0} y2={box.y1} stroke={GRID} strokeWidth={1} />
          <line y1={box.y1} y2={box.y1 + 5} stroke={MUTED} />
          <text y={box.y1 + 18} textAnchor="middle" fontSize={12} fill={MUTED}>
            {t.label}
          </text>
        </g>
      ))}
      <line x1={box.x0} x2={box.x1} y1={box.y1} y2={box.y1} stroke={MUTED} />
      <text x={(box.x0 + box.x1) / 2} y={box.height - 6} textAnchor="middle" fontSize={13} fill={FG}>
        {label}
      </text>
    </g>
  );
}

/** Left axis with grid lines; the label runs vertically along the axis. */
export function AxisLeft({ box, ticks, y, label }: { box: Box; ticks: Tick[]; y: (v: number) => number; label: string }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t.v} transform={`translate(0,${y(t.v)})`}>
          <line x1={box.x0} x2={box.x1} stroke={GRID} strokeWidth={1} />
          <line x1={box.x0 - 5} x2={box.x0} stroke={MUTED} />
          <text x={box.x0 - 8} dy="0.32em" textAnchor="end" fontSize={12} fill={MUTED}>
            {t.label}
          </text>
        </g>
      ))}
      <line x1={box.x0} x2={box.x0} y1={box.y0} y2={box.y1} stroke={MUTED} />
      <text
        transform={`translate(13,${(box.y0 + box.y1) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontSize={13}
        fill={FG}
      >
        {label}
      </text>
    </g>
  );
}

/** A clip rectangle for the plot area; returns the clipPath id. */
export function useClipId(): string {
  return `clip-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}

export function PlotClip({ id, box }: { id: string; box: Box }) {
  return (
    <defs>
      <clipPath id={id}>
        <rect x={box.x0} y={box.y0} width={Math.max(0, box.x1 - box.x0)} height={Math.max(0, box.y1 - box.y0)} />
      </clipPath>
    </defs>
  );
}

/**
 * Transparent rectangle over the plot that turns a tap or a horizontal drag
 * into a cursor position. touch-action: pan-y keeps vertical page scrolling
 * working on a phone.
 */
export function DragSurface({ box, onX }: { box: Box; onX: (px: number) => void }) {
  const dragging = React.useRef(false);
  const toLocal = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const scale = box.width / r.width;
    onX(Math.min(box.x1, Math.max(box.x0, (e.clientX - r.left) * scale)));
  };
  return (
    <rect
      x={box.x0}
      y={box.y0}
      width={Math.max(0, box.x1 - box.x0)}
      height={Math.max(0, box.y1 - box.y0)}
      fill="transparent"
      style={{ touchAction: "pan-y", cursor: "ew-resize" }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        toLocal(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) toLocal(e);
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    />
  );
}

/** Labelled range slider with its live value. `log` sliders move in decades. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  log = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display: string;
  log?: boolean;
}) {
  const id = React.useId();
  const pos = log ? Math.log10(value) : value;
  const lo = log ? Math.log10(min) : min;
  const hi = log ? Math.log10(max) : max;
  const st = step ?? (hi - lo) / 200;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="text-foreground">
          {label}
        </label>
        <output htmlFor={id} className="shrink-0 font-medium tabular-nums text-foreground">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={lo}
        max={hi}
        step={st}
        value={pos}
        aria-valuetext={display}
        onChange={(e) => {
          const p = Number(e.target.value);
          onChange(log ? Math.pow(10, p) : p);
        }}
        className="mt-1.5 h-6 w-full cursor-pointer accent-brand"
      />
    </div>
  );
}

export function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Reset
    </button>
  );
}

/** The sentence that says what the reader is looking at; announced politely to screen readers. */
export function Readout({ children }: { children: React.ReactNode }) {
  return (
    <div aria-live="polite" className="rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
      {children}
    </div>
  );
}

/** A short legend swatch (line + dash) as inline SVG. */
export function Swatch({ stroke, dash, width = 2.5 }: { stroke: string; dash?: string; width?: number }) {
  return (
    <svg aria-hidden width="26" height="10" className="shrink-0" viewBox="0 0 26 10">
      <line x1="1" x2="25" y1="5" y2="5" stroke={stroke} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}
