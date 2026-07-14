import React from "react";
import { panel, SUCCESS, BRAND, Sparkline, ChangeBadge, EmptyHint } from "../charts";
import type { ResolvedRange, RangeKey, CompareKey } from "./range";
import { delta } from "./range";

/**
 * Shared chrome for the analytics suite — server components only. The date
 * range and comparison are URL state (?range=…&compare=…), so every control is
 * a plain link and the whole suite works with zero client JS (Real-time adds
 * one tiny auto-refresh client component).
 */

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "this-month", label: "This month" },
  { key: "prev-month", label: "Prev month" },
  { key: "this-year", label: "This year" },
];

const COMPARES: { key: CompareKey; label: string }[] = [
  { key: "prev", label: "vs previous period" },
  { key: "year", label: "vs previous year" },
  { key: "none", label: "no comparison" },
];

export function href(section: string, range: ResolvedRange, overrides: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  p.set("range", overrides.range ?? range.key);
  p.set("compare", overrides.compare ?? range.compare);
  if ((overrides.range ?? range.key) === "custom") {
    p.set("from", overrides.from ?? range.days[0]);
    p.set("to", overrides.to ?? range.days[range.days.length - 1]);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (!["range", "compare", "from", "to"].includes(k)) p.set(k, v);
  }
  return `/admin/analytics${section ? `/${section}` : ""}?${p.toString()}`;
}

const pill = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  padding: "5px 11px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  color: active ? "var(--mn-active-text)" : "var(--theme-elevation-600)",
  background: active ? "var(--mn-brand-tint)" : "var(--theme-elevation-50)",
  border: `1px solid ${active ? "var(--metnmat-brand)" : "var(--theme-elevation-100)"}`,
});

export function RangeBar({ section, range }: { section: string; range: ResolvedRange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {RANGES.map((r) => (
          <a key={r.key} href={href(section, range, { range: r.key })} style={pill(range.key === r.key)}>
            {r.label}
          </a>
        ))}
        {/* Custom range — a plain GET form, no client JS. */}
        <form action={`/admin/analytics${section ? `/${section}` : ""}`} method="get" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
          <input type="hidden" name="range" value="custom" />
          <input type="hidden" name="compare" value={range.compare} />
          <input
            type="date"
            name="from"
            defaultValue={range.key === "custom" ? range.days[0] : undefined}
            aria-label="Custom range start"
            style={{ fontSize: 12, padding: "3px 6px", borderRadius: 8, border: "1px solid var(--theme-elevation-150)", background: "var(--theme-input-bg)", color: "var(--theme-text)" }}
          />
          <input
            type="date"
            name="to"
            defaultValue={range.key === "custom" ? range.days[range.days.length - 1] : undefined}
            aria-label="Custom range end"
            style={{ fontSize: 12, padding: "3px 6px", borderRadius: 8, border: "1px solid var(--theme-elevation-150)", background: "var(--theme-input-bg)", color: "var(--theme-text)" }}
          />
          <button type="submit" style={{ ...pill(range.key === "custom"), cursor: "pointer" }}>
            Custom
          </button>
        </form>
      </div>
      <span style={{ fontSize: 12, opacity: 0.6 }}>
        {range.label}
        {range.compare !== "none" && range.compareLabel ? ` · compared to ${range.compareLabel}` : ""}
      </span>
      <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
        {COMPARES.map((c) => (
          <a key={c.key} href={href(section, range, { compare: c.key })} style={pill(range.compare === c.key)}>
            {c.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  series,
  color = SUCCESS,
  current,
  previous,
  compare,
}: {
  label: string;
  value: string;
  sub?: string;
  series?: number[];
  color?: string;
  current: number;
  previous: number;
  compare: CompareKey;
}) {
  const d = delta(current, previous);
  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12.5, opacity: 0.6 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
        </div>
        {compare !== "none" && <ChangeBadge change={d} />}
      </div>
      {series && series.length > 1 ? (
        <div style={{ marginTop: 10 }}>
          <Sparkline data={series} color={color} />
        </div>
      ) : null}
      {sub ? <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

export const SECTIONS: { slug: string; label: string }[] = [
  { slug: "", label: "Highlights" },
  { slug: "realtime", label: "Real-time" },
  { slug: "traffic", label: "Traffic" },
  { slug: "behavior", label: "Behavior" },
  { slug: "marketing", label: "Marketing" },
  { slug: "recordings", label: "Session Recordings" },
  { slug: "insights", label: "Insights" },
  { slug: "benchmarks", label: "Benchmarks" },
  { slug: "reports", label: "All Reports" },
];

export function SectionTabs({ active, range }: { active: string; range: ResolvedRange }) {
  return (
    <nav aria-label="Analytics sections" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16, borderBottom: "1px solid var(--theme-elevation-100)", paddingBottom: 12 }}>
      {SECTIONS.map((s) => {
        const isActive = active === s.slug;
        return (
          <a
            key={s.slug || "highlights"}
            href={href(s.slug, range)}
            aria-current={isActive ? "page" : undefined}
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              padding: "7px 13px",
              borderRadius: 10,
              color: isActive ? "var(--mn-active-text)" : "var(--theme-elevation-600)",
              background: isActive ? "var(--mn-brand-tint)" : "transparent",
              boxShadow: isActive ? `inset 0 -2px 0 0 ${BRAND}` : "none",
            }}
          >
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}

/** One-line business purpose under a section heading — tells staff what
 *  question this page answers before they read a single chart. */
export function SectionIntro({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.6, margin: "12px 0 0", maxWidth: 760 }}>
      {children}
    </p>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function DataNotice({ firstDay }: { firstDay: string | null }) {
  return (
    <p style={{ fontSize: 11.5, opacity: 0.5, marginTop: 10 }}>
      {firstDay
        ? `First-party website analytics collected from ${firstDay} (IST). Business records (orders, RFQs) cover their full history.`
        : "First-party website analytics has no data yet — it starts collecting as soon as this deploy is live."}
    </p>
  );
}

export { EmptyHint };
