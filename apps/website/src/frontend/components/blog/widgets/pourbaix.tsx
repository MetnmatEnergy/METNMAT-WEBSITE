"use client";

/**
 * Pourbaix (potential–pH) diagram at 25 °C, drawn the way Pourbaix's Atlas
 * draws it: pH across, electrode potential (V vs SHE) up, each species' field
 * shaded by what it means for the metal (immunity, corrosion, passivation) and
 * the two water lines dashed. The fields are exact polygons from
 * lib/widgets/pourbaix-math.ts, where the tests pin the boundaries against the
 * Atlas.
 *
 * The reader moves a (pH, E) cursor (sliders, tap or drag) and the activity
 * chosen to mean "dissolved". Pourbaix's convention is 10⁻⁶ mol/L; lowering it
 * widens the corrosion fields, which is the point of the slider.
 */
import React from "react";
import type { PourbaixConfig } from "@/frontend/lib/widgets/schemas";
import {
  behaviourOf,
  fields,
  hydrogenLineE,
  oxygenLineE,
  parseFormula,
  speciesTerm,
  stableAt,
  waterAt,
  type Behaviour,
  type Term,
} from "@/frontend/lib/widgets/pourbaix-math";
import { fmt, linear, niceTicks, pow10 } from "@/frontend/lib/widgets/chart-math";
import { AxisBottom, AxisLeft, BG, BRAND, FG, MUTED, PlotClip, Readout, ResetButton, Slider, Svg, layout, linearTicks, useClipId, useWidth } from "./kit";

const FILL: Record<Behaviour, string> = {
  immunity: "var(--viz-3)",
  corrosion: "var(--viz-2)",
  passivation: "var(--viz-1)",
};
const BEHAVIOUR_NAME: Record<Behaviour, string> = {
  immunity: "Immunity: the metal is stable",
  corrosion: "Corrosion: a dissolved ion is stable",
  passivation: "Passivation possible: a solid oxide is stable",
};
/** Ag/AgCl in 3 M KCl, V vs SHE at 25 °C: the reference most readers have on the bench. */
const AG_AGCL_3M = 0.21;

const round = (v: number, step: number) => Math.round(v / step) * step;

/** Tap or drag anywhere on the plot to move the cursor; vertical swipes still scroll the page on a phone. */
function PointSurface({ box, onPoint }: { box: ReturnType<typeof layout>; onPoint: (px: number, py: number) => void }) {
  const dragging = React.useRef(false);
  const toLocal = (e: React.PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const scale = box.width / r.width;
    const px = Math.min(box.x1, Math.max(box.x0, (e.clientX - r.left) * scale));
    const py = Math.min(box.y1, Math.max(box.y0, (e.clientY - r.top) * scale));
    onPoint(px, py);
  };
  return (
    <rect
      x={box.x0}
      y={box.y0}
      width={Math.max(0, box.x1 - box.x0)}
      height={Math.max(0, box.y1 - box.y0)}
      fill="transparent"
      style={{ touchAction: "pan-y", cursor: "crosshair" }}
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

export function PourbaixWidget({ config }: { config: PourbaixConfig }) {
  const { element, species } = config;
  const [pH0, pH1] = config.pHRange;
  const [E0, E1] = config.ERange_V;

  const initial = React.useMemo(
    () => ({ pH: round((pH0 + pH1) / 2, 0.1), E: 0, logA: config.logActivity.default }),
    [pH0, pH1, config.logActivity.default],
  );
  const [pH, setPH] = React.useState(initial.pH);
  const [E, setE] = React.useState(Math.min(E1, Math.max(E0, initial.E)));
  const [logA, setLogA] = React.useState(initial.logA);
  const reset = () => {
    setPH(initial.pH);
    setE(Math.min(E1, Math.max(E0, initial.E)));
    setLogA(initial.logA);
  };

  // The schema has already checked every formula, so parseFormula cannot fail here.
  const comps = React.useMemo(() => species.map((sp) => parseFormula(sp.formula, element) as Exclude<ReturnType<typeof parseFormula>, string>), [species, element]);
  const terms: Term[] = React.useMemo(() => species.map((sp, i) => speciesTerm(sp, comps[i]!, logA)), [species, comps, logA]);
  const regions = React.useMemo(() => fields(terms, [pH0, pH1], [E0, E1]), [terms, pH0, pH1, E0, E1]);

  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const clipId = useClipId();
  const box = layout(width, { aspect: width < 480 ? 1.05 : 0.7, minH: 300 });
  const x = linear(pH0, pH1, box.x0, box.x1);
  const y = linear(E0, E1, box.y1, box.y0); // potential increases upwards
  const pHFromPx = linear(box.x0, box.x1, pH0, pH1);
  const EFromPx = linear(box.y1, box.y0, E0, E1);
  const path = (poly: [number, number][]) => poly.map((p, k) => `${k ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("") + "Z";

  const here = stableAt(terms, pH, E);
  const hereSp = species[here]!;
  const hereBehaviour = behaviourOf(hereSp, element);
  const water = waterAt(pH, E);

  const verdict = (() => {
    switch (hereBehaviour) {
      case "immunity":
        return `${element} is immune here: the metal itself is the stable form, so it cannot corrode.`;
      case "corrosion":
        return `${element} corrodes here: ${hereSp.label} in solution is more stable than the metal or any solid listed, even at ${pow10(logA)} mol/L.`;
      case "passivation":
        return `${hereSp.label} is the stable phase here. A film of it can slow corrosion (passivation), but only if it is dense and adherent, which the diagram cannot tell you.`;
    }
  })();
  const waterSentence =
    water === "reduced"
      ? "Below the hydrogen line: water itself is reduced, so hydrogen gas can form at this potential."
      : water === "oxidised"
        ? "Above the oxygen line: water itself is oxidised, so oxygen gas can form at this potential."
        : "Between the dashed lines water is stable.";

  const behavioursShown = [...new Set(regions.map((r) => behaviourOf(species[r.index]!, element)))];
  const pxArea = (box.x1 - box.x0) * (box.y1 - box.y0);
  const fullArea = (pH1 - pH0) * (E1 - E0);

  return (
    <div className="space-y-4">
      <div ref={wrapRef}>
        <Svg box={box} label={`Pourbaix diagram for ${element} at 25 °C: potential against pH, with the stability field of each species`}>
          <PlotClip id={clipId} box={box} />
          <g clipPath={`url(#${clipId})`}>
            {regions.map((r) => {
              const b = behaviourOf(species[r.index]!, element);
              return (
                <path key={r.index} d={path(r.polygon)} fill={FILL[b]} fillOpacity={r.index === here ? 0.34 : 0.2} stroke={FG} strokeOpacity={0.75} strokeWidth={1.4} strokeLinejoin="round">
                  <title>{species[r.index]!.label}</title>
                </path>
              );
            })}
            {config.showWaterLines && (
              <g>
                <line x1={x(pH0)} y1={y(hydrogenLineE(pH0))} x2={x(pH1)} y2={y(hydrogenLineE(pH1))} stroke={MUTED} strokeWidth={1.6} strokeDasharray="6 4" />
                <line x1={x(pH0)} y1={y(oxygenLineE(pH0))} x2={x(pH1)} y2={y(oxygenLineE(pH1))} stroke={MUTED} strokeWidth={1.6} strokeDasharray="6 4" />
              </g>
            )}
          </g>

          <AxisLeft box={box} ticks={linearTicks(niceTicks(E0, E1, box.narrow ? 6 : 8))} y={y} label="E (V vs SHE)" />
          <AxisBottom box={box} ticks={linearTicks(niceTicks(pH0, pH1, box.narrow ? 6 : 9))} x={x} label="pH" />

          {regions.map((r) => {
            // Only label a field with room for its name.
            if ((r.area / fullArea) * pxArea < (box.narrow ? 1400 : 1100)) return null;
            return (
              <text
                key={`l${r.index}`}
                x={x(r.centroid[0])}
                y={y(r.centroid[1])}
                dy="0.32em"
                textAnchor="middle"
                fontSize={box.narrow ? 12 : 13.5}
                fontWeight={700}
                fill={FG}
                stroke={BG}
                strokeWidth={3}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {species[r.index]!.label}
              </text>
            );
          })}
          {/* At the acid edge, under each line: the alkaline corner is where the small fields crowd. */}
          {config.showWaterLines && !box.narrow && (
            <g pointerEvents="none" fontSize={11.5} fill={MUTED} stroke={BG} strokeWidth={3} paintOrder="stroke">
              <text x={box.x0 + 6} y={y(oxygenLineE(pH0)) + 15}>
                O₂ / H₂O
              </text>
              <text x={box.x0 + 6} y={y(hydrogenLineE(pH0)) + 15}>
                H⁺ / H₂
              </text>
            </g>
          )}

          {/* Cursor */}
          <g pointerEvents="none">
            <line x1={box.x0} x2={box.x1} y1={y(E)} y2={y(E)} stroke={BRAND} strokeWidth={1} strokeOpacity={0.55} />
            <line x1={x(pH)} x2={x(pH)} y1={box.y0} y2={box.y1} stroke={BRAND} strokeWidth={1} strokeOpacity={0.55} />
            <circle cx={x(pH)} cy={y(E)} r={6} fill={BG} stroke={BRAND} strokeWidth={2.5} />
          </g>
          <PointSurface
            box={box}
            onPoint={(px, py) => {
              setPH(round(pHFromPx(px), 0.1));
              setE(round(EFromPx(py), 0.01));
            }}
          />
        </Svg>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        25 °C. Dissolved {element} species at an activity of {pow10(logA)} mol/L; solids and water at unit activity; gases
        at 1 bar. Each line is where two forms are equally stable. Tap or drag on the plot, or use the sliders, to move the
        cursor.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Slider label="pH" value={pH} min={pH0} max={pH1} step={0.1} onChange={(v) => setPH(round(v, 0.1))} display={fmt(pH, 3)} />
        <Slider label="Potential, E" value={E} min={E0} max={E1} step={0.01} onChange={(v) => setE(round(v, 0.01))} display={`${fmt(E, 3)} V vs SHE`} />
        <Slider
          label="Corrosion threshold (dissolved ions)"
          value={Math.pow(10, logA)}
          min={Math.pow(10, config.logActivity.min)}
          max={Math.pow(10, config.logActivity.max)}
          step={0.5}
          log
          onChange={(v) => setLogA(round(Math.log10(v), 0.5))}
          display={`${pow10(logA)} mol/L`}
        />
      </div>

      <Readout>
        <p className="font-medium">
          At pH {fmt(pH, 3)} and {fmt(E, 3)} V vs SHE ({fmt(E - AG_AGCL_3M, 3)} V vs Ag/AgCl, 3 M KCl):
        </p>
        <ul className="mt-1 space-y-1">
          <li>{verdict}</li>
          {config.showWaterLines && <li>{waterSentence}</li>}
        </ul>
      </Readout>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {behavioursShown.map((b) => (
            <li key={b} className="flex items-center gap-1.5">
              <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" className="shrink-0">
                <rect x="0.75" y="0.75" width="12.5" height="12.5" rx="2" fill={FILL[b]} fillOpacity={0.35} stroke={FG} strokeOpacity={0.6} />
              </svg>
              <span>{BEHAVIOUR_NAME[b]}</span>
            </li>
          ))}
          {config.showWaterLines && (
            <li className="flex items-center gap-1.5">
              <svg aria-hidden width="26" height="10" className="shrink-0" viewBox="0 0 26 10">
                <line x1="1" x2="25" y1="5" y2="5" stroke={MUTED} strokeWidth={1.6} strokeDasharray="6 4" />
              </svg>
              <span>Water is stable between the dashed lines</span>
            </li>
          )}
        </ul>
        <ResetButton onClick={reset} />
      </div>
    </div>
  );
}
