import React from "react";
import { projectEquirect } from "./world-geo";
import { LAND_XY } from "./world-land";

/**
 * Live world map for the Real-time panel. Hand-rolled equirectangular SVG (no
 * map library): a dense dotted landmass (LAND_XY, generated from public-domain
 * Natural Earth data) on a deep-navy "ocean", with a glowing, pulsing brand
 * marker for each ACTIVE visitor's country (SMIL — the Realtime view already
 * refreshes every 12s, so no client JS). Country-level, matching the ipinfo
 * "lite" data: markers sit at country centroids, never faked to a city.
 *
 * The panel renders its own fixed dark palette (a deliberate "live-ops" widget)
 * so it looks identical in the admin's light and dark themes.
 */

export type LivePoint = { country: string; count: number; lat: number; lng: number };

const W = 1000;
const H = 500;

type Placed = LivePoint & { x: number; y: number; cw: number; lx: number; ly: number };

// Greedy label layout: project each marker, then place its label above/below so
// labels for nearby countries (UK/Germany, UAE/India) don't overlap.
function layoutLabels(points: LivePoint[]): Placed[] {
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const out: Placed[] = [];
  const withXY = points
    .map((p) => {
      const [x, y] = projectEquirect(p.lat, p.lng, W, H);
      return { ...p, x, y };
    })
    .sort((a, b) => a.x - b.x);
  for (const p of withXY) {
    const cw = p.country.length * 6.4 + 18;
    const lx = Math.max(cw / 2 + 6, Math.min(W - cw / 2 - 6, p.x));
    const candidates = [p.y - 18, p.y + 18, p.y - 36, p.y + 36, p.y - 54, p.y + 54];
    let ly = candidates[0];
    for (const cand of candidates) {
      const box = { x1: lx - cw / 2, y1: cand - 9, x2: lx + cw / 2, y2: cand + 9 };
      const clash = placed.some((b) => !(box.x2 < b.x1 || box.x1 > b.x2 || box.y2 < b.y1 || box.y1 > b.y2));
      ly = cand;
      if (!clash) break;
    }
    placed.push({ x1: lx - cw / 2, y1: ly - 9, x2: lx + cw / 2, y2: ly + 9 });
    out.push({ ...p, cw, lx, ly });
  }
  return out;
}

export function WorldLiveMap({
  points,
  unlocated = 0,
  configured = true,
}: {
  points: LivePoint[];
  unlocated?: number;
  configured?: boolean;
}) {
  const total = points.reduce((n, p) => n + p.count, 0);
  const placed = layoutLabels(points);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {total > 0 ? (
            <>
              <span style={{ color: "#ff2b33" }}>●</span> {total} live visitor{total === 1 ? "" : "s"} in {points.length}{" "}
              countr{points.length === 1 ? "y" : "ies"}
            </>
          ) : (
            "No located visitors right now"
          )}
        </div>
        <span style={{ fontSize: 11, opacity: 0.5 }}>country-level · live</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="World map of active visitors" style={{ display: "block", borderRadius: 12 }}>
        <defs>
          <radialGradient id="mm-ocean" cx="50%" cy="44%" r="78%">
            <stop offset="0%" stopColor="#17294a" />
            <stop offset="58%" stopColor="#0d1b32" />
            <stop offset="100%" stopColor="#070f1d" />
          </radialGradient>
          <filter id="mm-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
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

        {/* dotted landmass (public-domain Natural Earth) */}
        <g fill="#4a6ea0" opacity={0.85}>
          {(() => {
            const els: React.ReactNode[] = [];
            for (let i = 0; i < LAND_XY.length; i += 2) els.push(<circle key={i} cx={LAND_XY[i]} cy={LAND_XY[i + 1]} r={1.5} />);
            return els;
          })()}
        </g>

        {/* active visitors */}
        {placed.map((p) => (
          <g key={p.country}>
            <title>{`${p.country} — ${p.count} active visitor${p.count === 1 ? "" : "s"}`}</title>
            <circle cx={p.x} cy={p.y} r={12} fill="#ff3b40" opacity={0.55} filter="url(#mm-glow)" />
            <circle cx={p.x} cy={p.y} r={6} fill="none" stroke="#ff595e" strokeWidth={1.6}>
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

      {(unlocated > 0 || !configured) && (
        <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}>
          {!configured ? (
            <>
              Geography isn’t configured yet — set <code>ANALYTICS_GEO_TOKEN</code> on the website to place visitors on the map.
            </>
          ) : (
            <>
              {unlocated} active visitor{unlocated === 1 ? "" : "s"} not shown (country not yet resolved). Markers are
              country-level; upgrade ipinfo to City tier for pinpoint locations.
            </>
          )}
        </div>
      )}
    </div>
  );
}
