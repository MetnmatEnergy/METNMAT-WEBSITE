"use client";

import React from "react";
import { WORLD_LAND_PATH, WORLD_BORDERS_PATH } from "./world-vector";

/**
 * Real-geography landmass layer of the live visitor map: filled Natural Earth
 * countries (110m) with a crisp coastline and fainter interior borders, drawn in
 * the same 1000×500 equirectangular viewBox as the visitor markers so they line
 * up exactly. See scripts/gen-world-vector.mjs for the (committed, dependency-free)
 * geometry.
 *
 * Deliberately a CLIENT component: the ~88KB of path geometry ships once inside
 * the cached JS chunk, so the Realtime page's 12s RSC refresh re-sends only a
 * module reference — not the geometry. The `mm-land` fill gradient is defined in
 * the parent SVG's <defs> (world-map.tsx).
 */
export function WorldLandLayer() {
  return (
    <>
      <path
        d={WORLD_LAND_PATH}
        fill="url(#mm-land)"
        stroke="#5b83c2"
        strokeOpacity={0.5}
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      <path
        d={WORLD_BORDERS_PATH}
        fill="none"
        stroke="#5f83bd"
        strokeOpacity={0.22}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
    </>
  );
}
