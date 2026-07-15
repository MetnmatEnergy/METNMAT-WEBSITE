import React from "react";

/**
 * Shared admin chart primitives — hand-rendered SVG (no chart libs, build stays
 * lean), used by the dashboard home (BeforeDashboard) and the Analytics view.
 * Colours come from custom-admin.css per-theme vars so everything stays
 * readable in BOTH light and dark mode.
 */

export const BRAND = "#d81f26";
export const SUCCESS = "var(--mn-success)";
export const WARNING = "var(--mn-warning)";
export const DANGER = "var(--mn-danger)";
export const INFO = "var(--mn-info)";
export const ACCENT = "var(--mn-accent)";
export const PURPLE = "var(--mn-purple)";
export const MUTED = "var(--mn-muted)";

export const STATUS_COLOR: Record<string, string> = {
  paid: SUCCESS,
  pending: WARNING,
  shipped: INFO,
  delivered: ACCENT,
  failed: DANGER,
  cancelled: MUTED,
  refunded: PURPLE,
};

/** Soft tint of a status colour for pill backgrounds (works with CSS vars). */
export const tint = (color: string) => `color-mix(in srgb, ${color} 14%, transparent)`;

export const PAID_STATUSES = new Set(["paid", "shipped", "delivered"]);

export const panel: React.CSSProperties = {
  background: "var(--theme-elevation-50)",
  border: "1px solid var(--theme-elevation-100)",
  borderRadius: 16,
  padding: 20,
};

// ── Formatters ────────────────────────────────────────────────────────────────

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const inrCompact = (n: number) => {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2) + " L";
  if (n >= 1e3) return "₹" + (n / 1e3).toFixed(1) + "k";
  return "₹" + Math.round(n).toLocaleString("en-IN");
};

export function pctChange(series: number[]): { text: string; up: boolean } {
  if (series.length < 2) return { text: "—", up: true };
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev === 0) return { text: last > 0 ? "New" : "—", up: last >= 0 };
  const pct = ((last - prev) / prev) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, up: pct >= 0 };
}

/** Build the last `n` month buckets ending with the current month. */
export function monthKeys(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return out;
}

export function monthKeyOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export const timeAgo = (iso?: string): string => {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

// ── SVG primitives ────────────────────────────────────────────────────────────

export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120;
  const h = 36;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const n = data.length;
  const step = n > 1 ? w / (n - 1) : w;
  const xOf = (i: number) => (n > 1 ? i * step : w / 2);
  const yOf = (v: number) => h - ((v - min) / span) * (h - 4) - 2;
  const pts = data.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  const id = `spk-${color.replace(/[^a-zA-Z0-9-]/g, "")}-${data.join("").length}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {n <= 1 ? (
        // A single point has no trend (and no y-scale) — show a flat marker line
        // + dot at mid-height so the card isn't blank.
        <>
          <line x1={4} x2={w - 4} y1={h / 2} y2={h / 2} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
          <circle cx={xOf(0)} cy={h / 2} r={2.5} fill={color} />
        </>
      ) : (
        <>
          <polygon points={areaPts} fill={`url(#${id})`} />
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function BarChart({
  months,
  values,
  color,
  ariaLabel = "Monthly values",
}: {
  months: string[];
  values: number[];
  color: string;
  ariaLabel?: string;
}) {
  const w = 640;
  const h = 220;
  const padB = 24;
  const padL = 6;
  const max = Math.max(...values, 1);
  const n = values.length;
  const slot = (w - padL) / n;
  const barW = Math.min(26, slot * 0.5);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel} style={{ display: "block" }}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={padL} x2={w} y1={(h - padB) * (1 - g)} y2={(h - padB) * (1 - g)} stroke="var(--theme-elevation-100)" strokeWidth={1} />
      ))}
      {values.map((v, i) => {
        const bh = ((h - padB) * v) / max;
        const x = padL + i * slot + (slot - barW) / 2;
        return (
          <g key={i}>
            <rect x={x} y={h - padB - bh} width={barW} height={Math.max(bh, 1)} rx={4} fill={color} opacity={0.92} />
            <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize={10} fill="var(--theme-elevation-500)">
              {months[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Area chart with up to two series (e.g. revenue + order count) on independent
 * scales — the Wix-style "trend" panel. Series B renders as a dashed line.
 */
export function LineArea({
  months,
  a,
  b,
  colorA,
  colorB,
  ariaLabel = "Trend",
}: {
  months: string[];
  a: number[];
  b?: number[];
  colorA: string;
  colorB?: string;
  ariaLabel?: string;
}) {
  const w = 640;
  const h = 220;
  const padB = 24;
  const padL = 6;
  const plotH = h - padB;
  const maxA = Math.max(...a, 1);
  const maxB = b ? Math.max(...b, 1) : 1;
  const n = a.length;
  const step = n > 1 ? (w - padL) / (n - 1) : w;
  const xOf = (i: number) => (n > 1 ? padL + i * step : w / 2);
  const yOf = (v: number, max: number) => plotH - (v / max) * (plotH - 8) - 2;
  const ptsOf = (vals: number[], max: number) => vals.map((v, i) => `${xOf(i)},${yOf(v, max)}`).join(" ");
  const ptsA = ptsOf(a, maxA);
  const areaA = `${padL},${plotH} ${ptsA} ${xOf(n - 1)},${plotH}`;
  const id = `la-${colorA.replace(/[^a-zA-Z0-9-]/g, "")}-${n}`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorA} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colorA} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line key={g} x1={padL} x2={w} y1={plotH * (1 - g)} y2={plotH * (1 - g)} stroke="var(--theme-elevation-100)" strokeWidth={1} />
      ))}
      {n <= 1 ? (
        // Single-point range (Today / Yesterday): a one-coordinate polyline is
        // invisible. A lone value has no y-scale (value/max === 1 would pin it to
        // the top and clip the label), so mark it at mid-height with a dot + flat
        // reference line + the value.
        <>
          <line x1={padL} x2={w} y1={plotH / 2} y2={plotH / 2} stroke={colorA} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />
          <circle cx={xOf(0)} cy={plotH / 2} r={4} fill={colorA} />
          <text x={xOf(0)} y={plotH / 2 - 9} textAnchor="middle" fontSize={13} fontWeight={700} fill={colorA}>{a[0] ?? 0}</text>
        </>
      ) : (
        <>
          <polygon points={areaA} fill={`url(#${id})`} />
          <polyline points={ptsA} fill="none" stroke={colorA} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {n > 1 && b && colorB ? (
        <polyline
          points={ptsOf(b, maxB)}
          fill="none"
          stroke={colorB}
          strokeWidth={2}
          strokeDasharray="5 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {months.map((m, i) =>
        i % Math.ceil(n / 12) === 0 ? (
          <text key={i} x={xOf(i)} y={h - 8} textAnchor="middle" fontSize={10} fill="var(--theme-elevation-500)">
            {m}
          </text>
        ) : null
      )}
    </svg>
  );
}

export function Donut({
  segments,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 180;
  const r = 70;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--theme-elevation-100)" strokeWidth={18} />
      {total > 0 &&
        segments.map((s, i) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={18}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      <text x={c} y={c - 4} textAnchor="middle" fontSize={26} fontWeight={800} fill="var(--theme-text)">
        {total}
      </text>
      <text x={c} y={c + 16} textAnchor="middle" fontSize={11} fill="var(--theme-elevation-500)">
        {centerLabel ?? "orders"}
      </text>
    </svg>
  );
}

/** Horizontal ranked bars (top products / top countries). */
export function HBars({
  rows,
  color,
  valueLabel,
}: {
  rows: { label: string; value: number; display: string }[];
  color: string;
  valueLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, paddingRight: 10 }}>
              {r.label}
            </span>
            <strong style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {r.display}
              {valueLabel ? <span style={{ opacity: 0.5, fontWeight: 500 }}> {valueLabel}</span> : null}
            </strong>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "var(--theme-elevation-100)", overflow: "hidden" }}>
            <div style={{ width: `${(r.value / max) * 100}%`, height: "100%", borderRadius: 999, background: color, opacity: 0.9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Time-of-day × weekday heatmap (rows Sun–Sat, cols 0–23 IST). */
export function Heatmap({ grid, ariaLabel = "Activity by time of day" }: { grid: number[][]; ariaLabel?: string }) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const max = Math.max(1, ...grid.flat());
  const cell = 16;
  const gap = 3;
  const labelW = 34;
  const w = labelW + 24 * (cell + gap);
  const h = 7 * (cell + gap) + 18;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel} style={{ display: "block" }}>
      {grid.map((row, d) =>
        row.map((v, hr) => (
          <rect
            key={`${d}-${hr}`}
            x={labelW + hr * (cell + gap)}
            y={d * (cell + gap)}
            width={cell}
            height={cell}
            rx={3}
            fill={v === 0 ? "var(--theme-elevation-100)" : BRAND}
            opacity={v === 0 ? 1 : 0.25 + 0.75 * (v / max)}
          >
            <title>{`${days[d]} ${hr}:00 — ${v}`}</title>
          </rect>
        ))
      )}
      {days.map((label, d) => (
        <text key={label} x={0} y={d * (cell + gap) + cell - 3} fontSize={10} fill="var(--theme-elevation-500)">
          {label}
        </text>
      ))}
      {[0, 6, 12, 18, 23].map((hr) => (
        <text key={hr} x={labelW + hr * (cell + gap)} y={h - 4} fontSize={9} fill="var(--theme-elevation-500)">
          {hr}
        </text>
      ))}
    </svg>
  );
}

/** Simple stage funnel with drop-off percentages. */
export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : s.value;
        const conv = prev > 0 ? Math.round((s.value / prev) * 100) : 0;
        return (
          <div key={s.label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                <strong>{s.value.toLocaleString("en-IN")}</strong>
                {i > 0 && <span style={{ opacity: 0.55, marginLeft: 8 }}>{conv}% of previous</span>}
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "var(--theme-elevation-100)", overflow: "hidden" }}>
              <div style={{ width: `${(s.value / max) * 100}%`, height: "100%", borderRadius: 999, background: BRAND, opacity: 0.9 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChangeBadge({ change }: { change: { text: string; up: boolean } }) {
  const color = change.up ? SUCCESS : BRAND;
  return (
    <span style={{ color, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
      {change.text !== "—" && change.text !== "New" ? (change.up ? "▲" : "▼") : ""} {change.text}
    </span>
  );
}

export function EmptyHint({ text }: { text: string }) {
  return <div style={{ fontSize: 13, opacity: 0.5, padding: "26px 4px", textAlign: "center" }}>{text}</div>;
}
