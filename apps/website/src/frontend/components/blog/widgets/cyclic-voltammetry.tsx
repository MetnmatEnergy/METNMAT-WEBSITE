"use client";

/**
 * Simulated cyclic voltammogram (lib/widgets/cv-sim.ts: Butler–Volmer
 * boundary, semi-infinite planar diffusion, optional EC follow-up step).
 *
 * Plotted in the IUPAC convention, which the caption states: potential
 * increases to the right, anodic current is positive. The bulk species is the
 * oxidised form, so the sweep starts at the positive end, runs to the vertex
 * and back. The first-load curve stays on the plot, faint, so the reader can
 * see what each slider changed.
 */
import React from "react";
import type { CvConfig } from "@/frontend/lib/widgets/schemas";
import { analyseCv, matsudaAyabe, randlesSevcikUa, simulateCv, type CvParams } from "@/frontend/lib/widgets/cv-sim";
import { fmt, linear, niceDomain, niceTicks } from "@/frontend/lib/widgets/chart-math";
import {
  AxisBottom,
  AxisLeft,
  BG,
  BRAND,
  DragSurface,
  MUTED,
  PALETTE,
  PlotClip,
  Readout,
  ResetButton,
  Slider,
  Svg,
  Swatch,
  layout,
  linearTicks,
  useClipId,
  useWidth,
} from "./kit";

type Knobs = { scanRate_V_s: number; k0_cm_s: number; C_mM: number; kc_s: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** A log slider range spanning `decades` either side of v, inside [lo, hi]. */
const around = (v: number, decades: number, lo: number, hi: number): [number, number] => [
  clamp(v / Math.pow(10, decades), lo, hi),
  clamp(v * Math.pow(10, decades), lo, hi),
];

function path(E: Float64Array, I: Float64Array, from: number, to: number, x: (v: number) => number, y: (v: number) => number) {
  let d = "";
  for (let j = from; j <= to; j++) d += `${j === from ? "M" : "L"}${x(E[j]!).toFixed(1)},${y(I[j]!).toFixed(1)}`;
  return d;
}

function toParams(config: CvConfig, k: Knobs): CvParams {
  return {
    mechanism: config.mechanism,
    n: config.n,
    E0_V: config.E0_V,
    k0_cm_s: k.k0_cm_s,
    alpha: config.alpha,
    D_cm2_s: config.D_cm2_s,
    C_mM: k.C_mM,
    area_cm2: config.area_cm2,
    scanRate_V_s: k.scanRate_V_s,
    window_V: config.window_V,
    kc_s: k.kc_s,
  };
}

const mV = (v: number) => `${fmt(v * 1000, 3)} mV`;
const volts = (v: number) => `${v.toFixed(3).replace("-", "−")} V`;

export function CyclicVoltammetryWidget({ config }: { config: CvConfig }) {
  const initial: Knobs = React.useMemo(
    () => ({
      scanRate_V_s: config.scanRate_V_s.default,
      k0_cm_s: config.k0_cm_s,
      C_mM: config.C_mM,
      kc_s: config.kc_s ?? 0,
    }),
    [config],
  );
  const [knobs, setKnobs] = React.useState<Knobs>(initial);
  const set = (k: keyof Knobs) => (v: number) => setKnobs((s) => ({ ...s, [k]: v }));
  const [cursorE, setCursorE] = React.useState<number | null>(null);

  const reference = React.useMemo(() => simulateCv(toParams(config, initial)), [config, initial]);
  const curve = React.useMemo(() => simulateCv(toParams(config, knobs)), [config, knobs]);
  const a = React.useMemo(() => analyseCv(curve), [curve]);
  const changed = (Object.keys(knobs) as (keyof Knobs)[]).some((k) => knobs[k] !== initial[k]);

  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const clipId = useClipId();
  const box = layout(width, { aspect: 0.66, left: width < 480 ? 52 : 60 });
  const [start, vertex] = config.window_V;
  const x = linear(vertex, start, box.x0, box.x1); // potential increases to the right
  const xFromPx = linear(box.x0, box.x1, vertex, start);

  let lo = 0;
  let hi = 0;
  for (const c of changed ? [curve, reference] : [curve]) {
    for (const v of c.I_uA) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const [yMin, yMax] = niceDomain(lo, hi, 6);
  const y = linear(yMin, yMax, box.y1, box.y0); // anodic (positive) up

  const regime = matsudaAyabe(toParams(config, knobs));
  const ipRev = randlesSevcikUa(toParams(config, knobs));
  const ref = config.ref;

  // Current on each branch at the cursor potential (linear interpolation).
  const at = (from: number, to: number, E: number): number | null => {
    for (let j = from; j < to; j++) {
      const e0 = curve.E[j]!;
      const e1 = curve.E[j + 1]!;
      if ((E - e0) * (E - e1) <= 0 && e0 !== e1) {
        const t = (E - e0) / (e1 - e0);
        return curve.I_uA[j]! + t * (curve.I_uA[j + 1]! - curve.I_uA[j]!);
      }
    }
    return null;
  };
  const v = curve.vertexIndex;
  const last = curve.E.length - 1;
  const cursor = cursorE === null ? null : { fwd: at(0, v, cursorE), rev: at(v, last, cursorE) };

  const has = (s: (typeof config.sliders)[number]) => config.sliders.includes(s);
  const scanRange: [number, number] = [config.scanRate_V_s.min, config.scanRate_V_s.max];
  const k0Range = around(config.k0_cm_s, 3, 1e-7, 100);
  const cRange = around(config.C_mM, 1, 1e-3, 1000);
  const kcRange = around(Math.max(config.kc_s ?? 1, 1e-3), 3, 1e-4, 1e6);

  const ip = a.cathodic ? -a.cathodic.I_uA : null;
  const summary = `Simulated cyclic voltammogram from ${volts(start)} to ${volts(vertex)} and back, ${ref}.`;

  return (
    <div className="space-y-4">
      <div ref={wrapRef}>
        <Svg box={box} label={summary}>
          <PlotClip id={clipId} box={box} />
          <AxisLeft box={box} ticks={linearTicks(niceTicks(yMin, yMax, 6))} y={y} label="Current (µA)" />
          <AxisBottom
            box={box}
            ticks={linearTicks(niceTicks(vertex, start, box.narrow ? 4 : 7))}
            x={x}
            label={`E (V ${ref.replace(/^vs\.?\s*/i, "vs ")})`}
          />
          {yMin < 0 && yMax > 0 && <line x1={box.x0} x2={box.x1} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth={1.25} />}
          <g clipPath={`url(#${clipId})`}>
            {changed && (
              <path
                d={path(reference.E, reference.I_uA, 0, reference.E.length - 1, x, y)}
                fill="none"
                stroke={MUTED}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.8}
              />
            )}
            <path d={path(curve.E, curve.I_uA, 0, v, x, y)} fill="none" stroke={PALETTE[0]} strokeWidth={2.25} strokeLinejoin="round" />
            <path d={path(curve.E, curve.I_uA, v, last, x, y)} fill="none" stroke={PALETTE[1]} strokeWidth={2.25} strokeLinejoin="round" />
          </g>
          {a.cathodic && (
            <g>
              <circle cx={x(a.cathodic.E_V)} cy={y(a.cathodic.I_uA)} r={4} fill={BG} stroke={PALETTE[0]} strokeWidth={2} />
              <text x={x(a.cathodic.E_V)} y={y(a.cathodic.I_uA) + 18} textAnchor="middle" fontSize={12} fill={PALETTE[0]} fontWeight={600}>
                Ep,c
              </text>
            </g>
          )}
          {a.anodic && (
            <g>
              <circle cx={x(a.anodic.E_V)} cy={y(a.anodic.I_uA)} r={4} fill={BG} stroke={PALETTE[1]} strokeWidth={2} />
              <text x={x(a.anodic.E_V)} y={y(a.anodic.I_uA) - 10} textAnchor="middle" fontSize={12} fill={PALETTE[1]} fontWeight={600}>
                Ep,a
              </text>
            </g>
          )}
          {cursorE !== null && (
            <g>
              <line x1={x(cursorE)} x2={x(cursorE)} y1={box.y0} y2={box.y1} stroke={BRAND} strokeWidth={1.25} />
              {cursor?.fwd != null && <circle cx={x(cursorE)} cy={y(cursor.fwd)} r={3.5} fill={PALETTE[0]} stroke={BG} />}
              {cursor?.rev != null && <circle cx={x(cursorE)} cy={y(cursor.rev)} r={3.5} fill={PALETTE[1]} stroke={BG} />}
            </g>
          )}
          <DragSurface box={box} onX={(px) => setCursorE(xFromPx(px))} />
        </Svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Swatch stroke={PALETTE[0]!} /> Forward sweep (towards {volts(vertex)})
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch stroke={PALETTE[1]!} /> Return sweep
        </span>
        {changed && (
          <span className="flex items-center gap-1.5">
            <Swatch stroke={MUTED} dash="4 3" width={1.5} /> First-load settings
          </span>
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        IUPAC convention: potential increases to the right and anodic current is positive, so the reduction of the
        oxidised species gives the downward (cathodic) peak. Planar electrode, semi-infinite diffusion, equal diffusion
        coefficients, no iR drop and no charging current. Tap the plot to read the current at a potential.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {has("scanRate_V_s") && (
          <Slider
            label="Scan rate, v"
            log
            value={knobs.scanRate_V_s}
            min={scanRange[0]}
            max={scanRange[1]}
            onChange={set("scanRate_V_s")}
            display={`${fmt(knobs.scanRate_V_s * 1000, 3)} mV/s`}
          />
        )}
        {has("k0_cm_s") && (
          <Slider
            label="Rate constant, k⁰"
            log
            value={knobs.k0_cm_s}
            min={k0Range[0]}
            max={k0Range[1]}
            onChange={set("k0_cm_s")}
            display={`${fmt(knobs.k0_cm_s, 2)} cm/s`}
          />
        )}
        {has("C_mM") && (
          <Slider
            label="Concentration, C*"
            log
            value={knobs.C_mM}
            min={cRange[0]}
            max={cRange[1]}
            onChange={set("C_mM")}
            display={`${fmt(knobs.C_mM, 2)} mM`}
          />
        )}
        {has("kc_s") && config.mechanism === "EC" && (
          <Slider
            label="Follow-up rate, k_c"
            log
            value={Math.max(knobs.kc_s, kcRange[0])}
            min={kcRange[0]}
            max={kcRange[1]}
            onChange={set("kc_s")}
            display={`${fmt(knobs.kc_s, 2)} s⁻¹`}
          />
        )}
      </div>

      <Readout>
        {ip !== null && a.cathodic ? (
          <p>
            Cathodic peak <strong>{fmt(ip, 3)} µA</strong> at {volts(a.cathodic.E_V)}
            {a.anodic && a.deltaEp_V !== null ? (
              <>
                ; anodic peak at {volts(a.anodic.E_V)}, so ΔEp = <strong>{mV(a.deltaEp_V)}</strong>.
              </>
            ) : (
              "; no anodic peak on the return sweep."
            )}{" "}
            Randles–Ševčík predicts {fmt(ipRev, 3)} µA for a reversible couple, and a reversible {config.n}-electron
            couple separates its peaks by about {fmt(57 / config.n, 2)} mV.
          </p>
        ) : (
          <p>The sweep turns back before the cathodic peak: the window ends too close to E⁰.</p>
        )}
        <p className="mt-1">
          Λ = k⁰/√(Dfv) = {fmt(regime.lambda, 2)}: <strong>{regime.regime}</strong> at this scan rate (Matsuda–Ayabe).
          {a.peakRatio !== null && (
            <>
              {" "}
              ip,a/ip,c = {a.peakRatio.toFixed(2)}
              {config.mechanism === "EC" && a.peakRatio < 0.9 ? ": the follow-up reaction removes R before the return sweep can re-oxidise it." : "."}
            </>
          )}
        </p>
        {cursorE !== null && cursor && (
          <p className="mt-1 text-muted-foreground">
            At {volts(cursorE)}: forward {cursor.fwd != null ? `${fmt(cursor.fwd, 3)} µA` : "–"}, return{" "}
            {cursor.rev != null ? `${fmt(cursor.rev, 3)} µA` : "–"}.
          </p>
        )}
      </Readout>

      <div className="flex justify-end">
        <ResetButton
          onClick={() => {
            setKnobs(initial);
            setCursorE(null);
          }}
        />
      </div>
    </div>
  );
}
