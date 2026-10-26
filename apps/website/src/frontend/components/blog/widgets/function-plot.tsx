"use client";

/**
 * Fallback model: curves y = f(x; params) from the whitelist expression
 * language in lib/widgets/expr.ts, with a slider per parameter.
 *
 * The y axis is fitted once, across every slider's range (each parameter at
 * its min and max with the others at default), so the axis stays still while
 * the reader drags and the curve visibly moves. A config may also fix it.
 */
import React from "react";
import type { FunctionPlotConfig } from "@/frontend/lib/widgets/schemas";
import { compileExpr, type Compiled } from "@/frontend/lib/widgets/expr";
import { fmt, linear, niceDomain, niceTicks } from "@/frontend/lib/widgets/chart-math";
import {
  AxisBottom,
  AxisLeft,
  BG,
  BRAND,
  DragSurface,
  MUTED,
  PlotClip,
  Readout,
  ResetButton,
  Slider,
  Svg,
  Swatch,
  layout,
  linearTicks,
  logTicks,
  seriesStyle,
  useClipId,
  useWidth,
} from "./kit";

const SAMPLES = 240;

const withUnit = (label: string, unit: string) => (unit ? `${label} (${unit})` : label);

type Axis = { log: boolean };
/** Value → axis space (log10 on a log axis; NaN where a log axis is undefined). */
const toAxis = (a: Axis, v: number) => (a.log ? (v > 0 ? Math.log10(v) : NaN) : v);
const fromAxis = (a: Axis, t: number) => (a.log ? Math.pow(10, t) : t);

function sampleXs(X: FunctionPlotConfig["x"]): Float64Array {
  const lo = toAxis(X, X.min);
  const hi = toAxis(X, X.max);
  const out = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) out[i] = fromAxis(X, lo + ((hi - lo) * i) / SAMPLES);
  return out;
}

/** Every curve at every sample, in y-axis space. */
function evaluateCurves(fns: Compiled[], xs: Float64Array, config: FunctionPlotConfig, params: Record<string, number>): number[][] {
  return fns.map((fn) =>
    Array.from(xs, (xv) => {
      const v = fn({ ...params, [config.x.symbol]: xv });
      return Number.isFinite(v) ? toAxis(config.y, v) : NaN;
    }),
  );
}

/** The y domain, fitted across each slider's extremes unless the config fixes it. */
function fitY(fns: Compiled[], xs: Float64Array, config: FunctionPlotConfig, defaults: Record<string, number>): [number, number] {
  const Y = config.y;
  const sets: Record<string, number>[] = [defaults];
  for (const p of config.params) sets.push({ ...defaults, [p.symbol]: p.min }, { ...defaults, [p.symbol]: p.max });
  const vals: number[] = [];
  for (const s of sets) for (const c of evaluateCurves(fns, xs, config, s)) for (const v of c) if (Number.isFinite(v)) vals.push(v);
  vals.sort((a, b) => a - b);
  // 1st–99th percentile, so a singularity (1/x at 0) cannot flatten every other curve.
  let lo = vals.length ? vals[Math.floor(vals.length * 0.01)]! : 0;
  let hi = vals.length ? vals[Math.min(vals.length - 1, Math.ceil(vals.length * 0.99))]! : 1;
  if (Y.min !== undefined) lo = toAxis(Y, Y.min);
  if (Y.max !== undefined) hi = toAxis(Y, Y.max);
  if (Y.log) return [Math.floor(lo), Math.max(Math.ceil(hi), Math.floor(lo) + 1)];
  if (Y.min !== undefined && Y.max !== undefined) return [lo, hi];
  return niceDomain(lo, hi, 6);
}

export function FunctionPlotWidget({ config }: { config: FunctionPlotConfig }) {
  const { x: X, y: Y } = config;
  const symbols = React.useMemo(() => [X.symbol, ...config.params.map((p) => p.symbol)], [X.symbol, config.params]);
  const fns = React.useMemo(
    () =>
      config.curves.map((c) => {
        const r = compileExpr(c.expr, symbols);
        // The schema already refused expressions that do not compile.
        return r.ok ? r.fn : ((() => NaN) as Compiled);
      }),
    [config.curves, symbols],
  );
  const defaults = React.useMemo(
    () => Object.fromEntries(config.params.map((p) => [p.symbol, p.default])) as Record<string, number>,
    [config.params],
  );
  const [params, setParams] = React.useState<Record<string, number>>(defaults);

  const tx = (v: number) => toAxis(X, v);
  const ty = (v: number) => toAxis(Y, v);
  const xLo = tx(X.min);
  const xHi = tx(X.max);
  const xs = React.useMemo(() => sampleXs(X), [X]);
  const [yLo, yHi] = React.useMemo(() => fitY(fns, xs, config, defaults), [fns, xs, config, defaults]);
  const curves = React.useMemo(() => evaluateCurves(fns, xs, config, params), [fns, xs, config, params]);

  const [cursorT, setCursorT] = React.useState((xLo + xHi) / 2);
  const cursorX = fromAxis(X, cursorT);

  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const clipId = useClipId();
  const box = layout(width, { aspect: 0.62 });
  const x = linear(xLo, xHi, box.x0, box.x1);
  const y = linear(yLo, yHi, box.y1, box.y0);
  const tFromPx = linear(box.x0, box.x1, xLo, xHi);

  const pathOf = (vals: number[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        pen = false;
        return;
      }
      // Clamp far outside values so the clip path, not the number, does the cutting.
      const py = y(Math.min(yHi + (yHi - yLo) * 2, Math.max(yLo - (yHi - yLo) * 2, v)));
      d += `${pen ? "L" : "M"}${x(tx(xs[i]!)).toFixed(1)},${py.toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const valuesAtCursor = fns.map((fn) => fn({ ...params, [X.symbol]: cursorX }));
  const xTicks = X.log ? logTicks(xLo, xHi, box.narrow ? 4 : 7) : linearTicks(niceTicks(xLo, xHi, box.narrow ? 4 : 7));
  const yTicks = Y.log ? logTicks(yLo, yHi, 6) : linearTicks(niceTicks(yLo, yHi, 6));
  const xUnit = X.unit ? ` ${X.unit}` : "";
  const yUnit = Y.unit ? ` ${Y.unit}` : "";

  return (
    <div className="space-y-4">
      <div ref={wrapRef}>
        <Svg box={box} label={`${withUnit(Y.label, Y.unit)} against ${withUnit(X.label, X.unit)}`}>
          <PlotClip id={clipId} box={box} />
          <AxisLeft box={box} ticks={yTicks} y={y} label={withUnit(Y.label, Y.unit)} />
          <AxisBottom box={box} ticks={xTicks} x={x} label={withUnit(X.label, X.unit)} />
          {!Y.log && yLo < 0 && yHi > 0 && <line x1={box.x0} x2={box.x1} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth={1.25} />}
          <g clipPath={`url(#${clipId})`}>
            {curves.map((vals, i) => {
              const st = seriesStyle(i);
              return (
                <path key={i} d={pathOf(vals)} fill="none" stroke={st.stroke} strokeDasharray={st.dash} strokeWidth={2.25} strokeLinejoin="round" />
              );
            })}
          </g>
          {config.markers.map((m, i) => {
            const px = x(tx(m.x));
            return (
              <g key={i}>
                <line x1={px} x2={px} y1={box.y0} y2={box.y1} stroke={MUTED} strokeDasharray="3 3" />
                <text x={px + 4} y={box.y0 + 12 + (i % 2) * 14} fontSize={11.5} fill={MUTED}>
                  {m.label}
                </text>
              </g>
            );
          })}
          <line x1={x(cursorT)} x2={x(cursorT)} y1={box.y0} y2={box.y1} stroke={BRAND} strokeWidth={1.25} />
          {valuesAtCursor.map((v, i) => {
            const t = ty(v);
            if (!Number.isFinite(t) || t < yLo || t > yHi) return null;
            return <circle key={i} cx={x(cursorT)} cy={y(t)} r={3.5} fill={seriesStyle(i).stroke} stroke={BG} strokeWidth={1.25} />;
          })}
          <DragSurface box={box} onX={(px) => setCursorT(tFromPx(px))} />
        </Svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        {config.curves.map((c, i) => {
          const st = seriesStyle(i);
          return (
            <span key={i} className="flex items-center gap-1.5">
              <Swatch stroke={st.stroke} dash={st.dash} /> {c.label}
            </span>
          );
        })}
      </div>

      {config.params.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {config.params.map((p) => (
            <Slider
              key={p.symbol}
              label={`${p.label} (${p.symbol})`}
              value={params[p.symbol] ?? p.default}
              min={p.min}
              max={p.max}
              step={p.step}
              onChange={(v) => setParams((s) => ({ ...s, [p.symbol]: v }))}
              display={`${fmt(params[p.symbol] ?? p.default, 3)}${p.unit ? ` ${p.unit}` : ""}`}
            />
          ))}
        </div>
      )}

      <Readout>
        <p>
          At {X.symbol} = {fmt(cursorX, 3)}
          {xUnit}:{" "}
          {config.curves.map((c, i) => (
            <span key={i}>
              {i > 0 ? "; " : ""}
              {c.label} = <strong>{Number.isFinite(valuesAtCursor[i]!) ? `${fmt(valuesAtCursor[i]!, 3)}${yUnit}` : "undefined"}</strong>
            </span>
          ))}
          .
        </p>
        <p className="mt-1 text-muted-foreground">Tap or drag across the plot to move the cursor.</p>
      </Readout>

      <div className="flex justify-end">
        <ResetButton
          onClick={() => {
            setParams(defaults);
            setCursorT((xLo + xHi) / 2);
          }}
        />
      </div>
    </div>
  );
}
