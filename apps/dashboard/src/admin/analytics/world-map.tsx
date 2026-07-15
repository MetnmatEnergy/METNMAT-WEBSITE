import React from "react";
import { centroidFor, projectEquirect } from "./world-geo";
import { WorldLandLayer } from "./world-land-layer";

/**
 * Live world map for the Real-time panel. Equirectangular SVG (no runtime map
 * library): real filled Natural Earth country geography with coastlines and
 * interior borders (WorldLandLayer — a client chunk, so the geometry isn't
 * re-sent on the 12s refresh) on a deep-navy "ocean", with a glowing, pulsing
 * brand marker for each ACTIVE visitor's country and a ranked legend linking to
 * the Geography report. The land is pixel-aligned to the marker projection
 * (both use the same Plate Carrée mapping — see scripts/gen-world-vector.mjs).
 * Country-level, matching the ipinfo "lite" data: markers sit at country
 * centroids, never faked to a city.
 *
 * Honesty rules: countries we can't place on the map are still LISTED in the
 * legend (marked "not on map"), and visitors with no resolved country are
 * counted in a footnote — nothing is silently dropped. Pulse animations are
 * disabled for prefers-reduced-motion users. The panel keeps its own fixed
 * dark palette (a deliberate "live-ops" widget) in both admin themes.
 */

export type LiveCountry = { country: string; count: number };

const W = 1000;
const H = 500;

type Placed = LiveCountry & { x: number; y: number; cw: number; lx: number; ly: number };

// Greedy label layout: place each label above/below its marker so labels for
// nearby countries (UK/Germany, UAE/India) never overlap.
function layoutLabels(points: (LiveCountry & { x: number; y: number })[]): Placed[] {
  const taken: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const out: Placed[] = [];
  for (const p of [...points].sort((a, b) => a.x - b.x)) {
    const cw = p.country.length * 6.4 + 18;
    const lx = Math.max(cw / 2 + 6, Math.min(W - cw / 2 - 6, p.x));
    const candidates = [p.y - 18, p.y + 18, p.y - 36, p.y + 36, p.y - 54, p.y + 54];
    let ly = candidates[0];
    for (const cand of candidates) {
      const box = { x1: lx - cw / 2, y1: cand - 9, x2: lx + cw / 2, y2: cand + 9 };
      const clash = taken.some((b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2));
      ly = cand;
      if (!clash) break;
    }
    taken.push({ x1: lx - cw / 2, y1: ly - 9, x2: lx + cw / 2, y2: ly + 9 });
    out.push({ ...p, cw, lx, ly });
  }
  return out;
}

/** "12:04:32 IST" — server render time; the 12s auto-refresh keeps it honest. */
function istClock(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(11, 19) + " IST";
}

export function WorldLiveMap({
  countries,
  unlocated = 0,
  configured = true,
}: {
  /** Active-visitor counts per resolved country name (ipinfo naming). */
  countries: LiveCountry[];
  /** Active visitors whose country hasn't been resolved. */
  unlocated?: number;
  configured?: boolean;
}) {
  const ranked = [...countries].sort((a, b) => b.count - a.count);
  const mappable: (LiveCountry & { x: number; y: number })[] = [];
  for (const c of ranked) {
    const cent = centroidFor(c.country);
    if (cent) {
      const [x, y] = projectEquirect(cent[0], cent[1], W, H);
      mappable.push({ ...c, x, y });
    }
  }
  const placed = layoutLabels(mappable);
  const total = ranked.reduce((n, p) => n + p.count, 0) + unlocated;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {total > 0 ? (
            <>
              <span style={{ color: "#ff2b33" }}>●</span> {total} live visitor{total === 1 ? "" : "s"}
              {ranked.length > 0 && (
                <span style={{ fontWeight: 500, opacity: 0.75 }}>
                  {" "}
                  in {ranked.length} countr{ranked.length === 1 ? "y" : "ies"}
                </span>
              )}
            </>
          ) : (
            "Listening for live visitors…"
          )}
        </div>
        <span style={{ fontSize: 11, opacity: 0.5 }}>country-level · as of {istClock()}</span>
      </div>

      <svg className="mn-live-map__svg" viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map of active visitors" style={{ display: "block", borderRadius: 12 }}>
        <title>World map of active visitors</title>
        <desc>
          {total > 0
            ? `${total} active visitors: ${ranked.map((c) => `${c.country} ${c.count}`).join(", ")}${unlocated ? `, ${unlocated} unlocated` : ""}`
            : "No active visitors right now"}
        </desc>
        <defs>
          <radialGradient id="mm-ocean" cx="50%" cy="44%" r="78%">
            <stop offset="0%" stopColor="#17294a" />
            <stop offset="58%" stopColor="#0d1b32" />
            <stop offset="100%" stopColor="#070f1d" />
          </radialGradient>
          <linearGradient id="mm-land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b4a7c" />
            <stop offset="100%" stopColor="#1b3057" />
          </linearGradient>
          <filter id="mm-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
          <style>{`@media (prefers-reduced-motion: reduce) { .mm-ping { display: none } }`}</style>
        </defs>

        <rect width={W} height={H} fill="url(#mm-ocean)" />

        {/* graticule */}
        <g stroke="#8fbaff" strokeWidth={0.5} opacity={0.05}>
          {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((lng) => {
            const x = (lng / 360) * W;
            return <line key={`v${lng}`} x1={x} y1={0} x2={x} y2={H} />;
          })}
          {[30, 60, 90, 120, 150].map((lat) => {
            const y = (lat / 180) * H;
            return <line key={`h${lat}`} x1={0} y1={y} x2={W} y2={y} />;
          })}
        </g>

        <WorldLandLayer />

        {/* active visitors */}
        {placed.map((p) => (
          <g key={p.country}>
            <title>{`${p.country} — ${p.count} active visitor${p.count === 1 ? "" : "s"}`}</title>
            <circle cx={p.x} cy={p.y} r={12} fill="#ff3b40" opacity={0.55} filter="url(#mm-glow)" />
            <circle className="mm-ping" cx={p.x} cy={p.y} r={6} fill="none" stroke="#ff595e" strokeWidth={1.6}>
              <animate attributeName="r" values="6;28" dur="2.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.75;0" dur="2.6s" repeatCount="indefinite" />
            </circle>
            <circle cx={p.x} cy={p.y} r={p.count > 1 ? 7.5 : 5.5} fill="#ff2b33" stroke="#fff" strokeWidth={1.5} />
            {p.count > 1 && (
              <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={800} fill="#fff">
                {p.count}
              </text>
            )}
            <g transform={`translate(${(p.lx - p.cw / 2).toFixed(0)},${(p.ly - 9).toFixed(0)})`}>
              <rect width={Math.round(p.cw)} height={18} rx={9} fill="rgba(8,14,26,0.92)" stroke="#ff3b40" strokeOpacity={0.55} />
              <text x={Math.round(p.cw / 2)} y={9.5} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} fill="#fff">
                {p.country}
              </text>
            </g>
          </g>
        ))}

        <rect width={W} height={H} fill="none" stroke="#ffffff" strokeOpacity={0.07} rx={12} />
      </svg>

      {/* Ranked legend — every active country, including any we can't place. */}
      {(ranked.length > 0 || unlocated > 0 || !configured) && (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {ranked.map((c) => {
            const onMap = mappable.some((m) => m.country === c.country);
            return (
              <span
                key={c.country}
                title={onMap ? undefined : "No map position for this country name — shown here so it isn't hidden."}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--theme-elevation-150)",
                  background: "var(--theme-elevation-50)",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "#ff2b33" }} />
                {c.country}
                <span style={{ opacity: 0.55 }}>×{c.count}</span>
                {!onMap && <span style={{ opacity: 0.5, fontWeight: 500 }}>(not on map)</span>}
              </span>
            );
          })}
          {unlocated > 0 && (
            <span style={{ fontSize: 11.5, opacity: 0.6 }}>
              +{unlocated} not yet located
            </span>
          )}
          {!configured && (
            <span style={{ fontSize: 11.5, opacity: 0.6 }}>
              Geography isn’t configured — set <code>ANALYTICS_GEO_TOKEN</code> on the website.
            </span>
          )}
          <a
            href="/admin/analytics/traffic?range=today&compare=none"
            style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "var(--metnmat-brand, #d81f26)", textDecoration: "none" }}
          >
            Geography report →
          </a>
        </div>
      )}
    </div>
  );
}
