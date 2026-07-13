"use client";

import React from "react";
import { LAND_PATH } from "./world-land";

/**
 * The dotted-landmass layer of the live visitor map. Deliberately a CLIENT
 * component: the ~40KB path geometry ships once inside the cached JS chunk and
 * the Realtime page's 12s RSC refresh then re-sends only a module reference —
 * not the geometry. (As a server component the path string would ride the
 * flight payload on every refresh.) One <path> node ("m dx dy h0" per dot with
 * round caps) instead of thousands of <circle>s keeps paint + hydration cheap.
 */
export function WorldLandLayer() {
  return (
    <path
      d={LAND_PATH}
      fill="none"
      stroke="#4a6ea0"
      strokeWidth={2.6}
      strokeLinecap="round"
      opacity={0.85}
    />
  );
}
