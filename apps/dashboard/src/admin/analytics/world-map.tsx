import React from "react";
import { COUNTRY_CENTROIDS, projectEquirect } from "./world-geo";

/**
 * Live world map for the Real-time panel. Hand-rolled equirectangular SVG (no
 * map library, per repo convention): a faint constellation of country
 * centroids gives the geographic backdrop, and each ACTIVE visitor's country
 * gets a pulsing brand-red dot (SMIL animation — the Realtime view already
 * refreshes every 12s, so no client JS). Country-level only, matching the
 * ipinfo "lite" data; dots sit at country centroids, never faked to a city.
 */

export type LivePoint = { country: string; count: number; lat: number; lng: number };

const W = 720;
const H = 360;
const BRAND = "var(--metnmat-brand, #d81f26)";

// Backdrop: every known country centroid as a faint dot → rough world shape.
const BACKDROP = Object.values(COUNTRY_CENTROIDS).map(([lat, lng]) => projectEquirect(lat, lng, W, H));

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
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {total > 0 ? (
            <>
              <span style={{ color: BRAND }}>●</span> {total} live visitor{total === 1 ? "" : "s"} in{" "}
              {points.length} countr{points.length === 1 ? "y" : "ies"}
            </>
          ) : (
            "No located visitors right now"
          )}
        </div>
        <span style={{ fontSize: 11, opacity: 0.5 }}>country-level · live</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="World map of active visitors"
        style={{ display: "block", borderRadius: 10, background: "var(--theme-elevation-50)", border: "1px solid var(--theme-elevation-100)" }}
      >
        {/* Graticule: 30° grid */}
        <g stroke="var(--theme-elevation-150)" strokeWidth={0.5} opacity={0.5}>
          {[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((lng) => {
            const x = (lng / 360) * W;
            return <line key={`v${lng}`} x1={x} y1={0} x2={x} y2={H} />;
          })}
          {[30, 60, 90, 120, 150].map((lat) => {
            const y = (lat / 180) * H;
            return <line key={`h${lat}`} x1={0} y1={y} x2={W} y2={y} />;
          })}
        </g>

        {/* Land backdrop: faint country centroids */}
        <g fill="var(--theme-elevation-300)" opacity={0.55}>
          {BACKDROP.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.7} />
          ))}
        </g>

        {/* Active visitors */}
        {points.map((p) => {
          const [x, y] = projectEquirect(p.lat, p.lng, W, H);
          const labelX = Math.max(30, Math.min(W - 30, x));
          const labelBelow = y < 26;
          return (
            <g key={p.country}>
              <title>{`${p.country} — ${p.count} active visitor${p.count === 1 ? "" : "s"}`}</title>
              {/* pulsing ping */}
              <circle cx={x} cy={y} r={5} fill="none" stroke={BRAND} strokeWidth={1.5}>
                <animate attributeName="r" from="5" to="20" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.75" to="0" dur="1.8s" repeatCount="indefinite" />
              </circle>
              {/* core dot (grows a touch when it carries a count) */}
              <circle cx={x} cy={y} r={p.count > 1 ? 8 : 5} fill={BRAND} stroke="#fff" strokeWidth={1} />
              {p.count > 1 && (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#fff">
                  {p.count}
                </text>
              )}
              {/* country label */}
              <text
                x={labelX}
                y={labelBelow ? y + 16 : y - 11}
                textAnchor="middle"
                fontSize={10.5}
                fontWeight={600}
                fill="var(--theme-text)"
                stroke="var(--theme-elevation-50)"
                strokeWidth={2.4}
                paintOrder="stroke"
              >
                {p.country}
              </text>
            </g>
          );
        })}
      </svg>

      {(unlocated > 0 || !configured) && (
        <div style={{ fontSize: 11.5, opacity: 0.6, marginTop: 8, lineHeight: 1.5 }}>
          {!configured ? (
            <>
              Geography isn’t configured yet — set <code>ANALYTICS_GEO_TOKEN</code> on the website to place visitors on
              the map.
            </>
          ) : (
            <>
              {unlocated} active visitor{unlocated === 1 ? "" : "s"} not shown (country not yet resolved). Dots are
              country-level; upgrade ipinfo to City tier for pinpoint locations.
            </>
          )}
        </div>
      )}
    </div>
  );
}
