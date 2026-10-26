"use client";

/**
 * Ellingham diagram: ΔG° of oxide formation per mol O₂ against temperature,
 * drawn the textbook way, with ΔG° becoming MORE NEGATIVE DOWNWARDS so the
 * most stable oxides sit at the bottom (Gaskell, ch. 12). The arithmetic and
 * the axis direction live in lib/widgets/ellingham-math.ts, where the tests
 * pin them.
 *
 * The reader moves a temperature cursor (slider, tap or drag) and, when the
 * article enables them, the pO₂, H₂/H₂O and CO/CO₂ scales. Each scale is the
 * modern form of the nomogram printed on the margin of a paper diagram: one
 * ray of constant oxygen potential the reader can swing, plus the equilibrium
 * values at the cursor in the table below the plot.
 */
import React from "react";
import type { EllinghamConfig } from "@/frontend/lib/widgets/schemas";
import {
  ZERO_C_IN_K,
  classifyOxides,
  coLine,
  dG,
  equilibriumLog10PO2,
  equilibriumLog10Ratio,
  isValidAt,
  oxideName,
  oxygenPotentialFromPO2,
  oxygenPotentialFromRatio,
  reductantOf,
  reductantPotential,
  yToPx,
  type EllinghamLine,
  type ReductionVerdict,
  type Reductant,
} from "@/frontend/lib/widgets/ellingham-math";
import { fmt, fmtFromLog10, linear, listNames, niceDomain, niceTicks, pow10, tickLabel } from "@/frontend/lib/widgets/chart-math";
import {
  AxisBottom,
  AxisLeft,
  BG,
  BRAND,
  DragSurface,
  FG,
  MUTED,
  PlotClip,
  Readout,
  ResetButton,
  Slider,
  Svg,
  Swatch,
  layout,
  linearTicks,
  seriesStyle,
  useClipId,
  useWidth,
} from "./kit";

const REDUCTANT_DASH: Record<Reductant, string | undefined> = { C: undefined, CO: "7 4", H2: "2 3" };

/** Short end-of-line label: the oxide, or the reductant's reaction. */
function shortLabel(l: EllinghamLine): string {
  const r = reductantOf(l.label);
  if (r === "C") return `C→${oxideName(l.label)}`;
  if (r === "CO") return "CO→CO₂";
  if (r === "H2") return "H₂→H₂O";
  return oxideName(l.label);
}

/** Pushes labels apart vertically so none overlap, keeping them inside [top, bottom]. */
function spread<T extends { y: number }>(items: T[], gap: number, top: number, bottom: number): T[] {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) if (s[i]!.y < s[i - 1]!.y + gap) s[i]!.y = s[i - 1]!.y + gap;
  for (let i = s.length - 1; i >= 0; i--) {
    const limit = i === s.length - 1 ? bottom : s[i + 1]!.y - gap;
    if (s[i]!.y > limit) s[i]!.y = limit;
  }
  for (let i = 0; i < s.length; i++) if (s[i]!.y < top) s[i]!.y = top;
  return s;
}

function sentence(subject: string, v: ReductionVerdict): string | null {
  if (v.potential === null || (!v.reduces.length && !v.cannot.length)) return null;
  if (!v.reduces.length) return `${subject} cannot reduce any of the oxides shown.`;
  if (!v.cannot.length) return `${subject} can reduce every oxide shown.`;
  return `${subject} can reduce ${listNames(v.reduces)}, but not ${listNames(v.cannot, "or")}.`;
}

const RATIO_RANGE = { min: -6, max: 8 };
const PO2_RANGE = { min: -50, max: 0 };

export function EllinghamWidget({ config }: { config: EllinghamConfig }) {
  const [tMinC, tMaxC] = config.temperatureRangeC;
  const lines = config.lines;
  const highlight = React.useMemo(() => new Set(config.highlight), [config.highlight]);
  const hLine = React.useMemo(() => lines.find((l) => reductantOf(l.label) === "H2") ?? null, [lines]);
  const cLine = React.useMemo(() => coLine(lines), [lines]);
  const hasCarbon = lines.some((l) => reductantOf(l.label) === "C");
  const scales = config.showScales;

  const initial = React.useMemo(
    () => ({ T_C: Math.round((tMinC + (tMaxC - tMinC) / 2) / 10) * 10, logPO2: -10, logH: 0, logCO: 0 }),
    [tMinC, tMaxC],
  );
  const [T_C, setT] = React.useState(initial.T_C);
  const [logPO2, setPO2] = React.useState(initial.logPO2);
  const [logH, setH] = React.useState(initial.logH);
  const [logCO, setCO] = React.useState(initial.logCO);
  const reset = () => {
    setT(initial.T_C);
    setPO2(initial.logPO2);
    setH(initial.logH);
    setCO(initial.logCO);
  };

  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const clipId = useClipId();
  // Taller on a phone: the lines need vertical room more than the axis needs width.
  const box = layout(width, { right: width < 480 ? 50 : 66, aspect: width < 480 ? 1.15 : 0.74, minH: 300 });
  const TminK = tMinC + ZERO_C_IN_K;
  const TmaxK = tMaxC + ZERO_C_IN_K;
  const TK = T_C + ZERO_C_IN_K;

  // Visible segment of each line, and the ΔG° range they span.
  const segments = React.useMemo(
    () =>
      lines.map((l, i) => {
        const a = Math.max(l.validFromK, TminK);
        const b = Math.min(l.validToK, TmaxK);
        return { l, i, a, b, visible: b > a };
      }),
    [lines, TminK, TmaxK],
  );
  const [yMin, yMax] = React.useMemo(() => {
    let lo = Infinity;
    let hi = 0; // 0 is always on the axis: it is where oxides stop being stable at all
    for (const s of segments) {
      if (!s.visible) continue;
      for (const T of [s.a, s.b]) {
        lo = Math.min(lo, dG(s.l, T));
        hi = Math.max(hi, dG(s.l, T));
      }
    }
    if (!Number.isFinite(lo)) lo = -1000;
    const [dlo, dhi] = niceDomain(lo, hi, 6);
    return [dlo, Math.max(0, dhi)];
  }, [segments]);

  const x = linear(tMinC, tMaxC, box.x0, box.x1);
  const y = (g: number) => yToPx(g, yMin, yMax, box.y0, box.y1 - box.y0);
  const xFromPx = linear(box.x0, box.x1, tMinC, tMaxC);

  const styleOf = (l: EllinghamLine, i: number) => {
    const r = reductantOf(l.label);
    const strong = highlight.has(l.label);
    if (r) return { stroke: FG, dash: REDUCTANT_DASH[r], width: strong ? 3 : 2.25 };
    const s = seriesStyle(i);
    return { stroke: s.stroke, dash: s.dash, width: strong ? 3.25 : 1.9 };
  };

  // End labels: one per short label (piecewise lines share a name), at the rightmost piece.
  const endLabels = (() => {
    const last = new Map<string, (typeof segments)[number]>();
    for (const s of segments) {
      if (!s.visible) continue;
      const k = shortLabel(s.l);
      const prev = last.get(k);
      if (!prev || s.b > prev.b) last.set(k, s);
    }
    const atEdge: { y: number; text: string; color: string; strong: boolean }[] = [];
    const inside: { x: number; y: number; text: string; color: string; strong: boolean }[] = [];
    for (const [text, s] of last) {
      const st = styleOf(s.l, s.i);
      const item = { y: y(dG(s.l, s.b)), text, color: st.stroke, strong: highlight.has(s.l.label) };
      if (s.b >= TmaxK - 1e-6) atEdge.push(item);
      else inside.push({ ...item, x: x(s.b - ZERO_C_IN_K) + 4 });
    }
    // Labels ending inside the plot: nudge down past any earlier one they would overlap.
    inside.sort((p, q) => p.y - q.y);
    for (let i = 1; i < inside.length; i++) {
      for (let tries = 0; tries < 6; tries++) {
        const clash = inside.slice(0, i).some((o) => Math.abs(o.x - inside[i]!.x) < 40 && Math.abs(o.y - inside[i]!.y) < 13);
        if (!clash) break;
        inside[i]!.y += 13;
      }
    }
    return { atEdge: spread(atEdge, 13, box.y0 + 4, box.y1 - 2), inside };
  })();

  // Rays of constant oxygen potential for the enabled scales: p(T) = a + b·T.
  type Ray = { key: string; a: number; b: number; from: number; to: number; dash: string; label: string };
  const rays: Ray[] = [];
  const LN10R = 0.008314462618 * Math.LN10;
  if (scales.pO2) rays.push({ key: "pO2", a: 0, b: LN10R * logPO2, from: TminK, to: TmaxK, dash: "5 4", label: `pO₂ ${pow10(logPO2)}` });
  if (scales.H2_H2O && hLine) {
    rays.push({
      key: "H2",
      a: hLine.A_kJ,
      b: hLine.B_kJ_per_K - 2 * LN10R * logH,
      from: Math.max(TminK, hLine.validFromK),
      to: Math.min(TmaxK, hLine.validToK),
      dash: "1.5 3",
      label: `H₂/H₂O ${fmtFromLog10(logH)}`,
    });
  }
  if (scales.CO_CO2 && cLine) {
    rays.push({
      key: "CO",
      a: cLine.A_kJ,
      b: cLine.B_kJ_per_K - 2 * LN10R * logCO,
      from: Math.max(TminK, cLine.validFromK),
      to: Math.min(TmaxK, cLine.validToK),
      dash: "8 3 2 3",
      label: `CO/CO₂ ${fmtFromLog10(logCO)}`,
    });
  }
  /** Where a ray leaves the plot on the right, bottom or top edge (pixels). */
  const rayEnd = (r: Ray) => {
    let T = r.to;
    let g = r.a + r.b * T;
    if (g < yMin && r.b < 0) {
      T = (yMin - r.a) / r.b;
      g = yMin;
    } else if (g > yMax && r.b > 0) {
      T = (yMax - r.a) / r.b;
      g = yMax;
    }
    return { px: x(T - ZERO_C_IN_K), py: y(g) };
  };

  // ── Readout at the cursor ──────────────────────────────────────────────
  const verdicts: string[] = [];
  if (hasCarbon) {
    const v = classifyOxides(lines, TK, reductantPotential(lines, "C", TK));
    const s = sentence("Carbon", v);
    if (s) verdicts.push(s);
  }
  if (hLine && isValidAt(hLine, TK)) {
    const ratio = scales.H2_H2O ? logH : 0;
    const v = classifyOxides(lines, TK, oxygenPotentialFromRatio(hLine, TK, ratio));
    const s = sentence(
      scales.H2_H2O ? `Hydrogen at pH₂/pH₂O = ${fmtFromLog10(ratio)}` : "Hydrogen (pH₂ = pH₂O)",
      v,
    );
    if (s) verdicts.push(s);
  }
  if (scales.CO_CO2 && cLine && isValidAt(cLine, TK)) {
    const v = classifyOxides(lines, TK, oxygenPotentialFromRatio(cLine, TK, logCO));
    const s = sentence(`Carbon monoxide at pCO/pCO₂ = ${fmtFromLog10(logCO)}`, v);
    if (s) verdicts.push(s);
  }
  if (scales.pO2) {
    const v = classifyOxides(lines, TK, oxygenPotentialFromPO2(TK, logPO2));
    const at = `At pO₂ = ${pow10(logPO2)} bar`;
    if (v.reduces.length && v.cannot.length) {
      verdicts.push(`${at}, ${listNames(v.reduces)} ${v.reduces.length === 1 ? "decomposes" : "decompose"} to metal; ${listNames(v.cannot)} ${v.cannot.length === 1 ? "is" : "are"} stable.`);
    } else if (v.cannot.length) verdicts.push(`${at}, every oxide shown is stable.`);
    else if (v.reduces.length) verdicts.push(`${at}, every oxide shown decomposes to its metal.`);
  }
  const oxidesHere = lines.filter((l) => !reductantOf(l.label) && isValidAt(l, TK));
  // Oxides with no piece valid at T: say so, rather than let them vanish from the verdicts.
  const outOfRange = [
    ...new Set(lines.filter((l) => !reductantOf(l.label)).map((l) => oxideName(l.label))),
  ].filter((name) => !oxidesHere.some((l) => oxideName(l.label) === name));

  const cursorPx = x(T_C);
  const summary = `Ellingham diagram, ${tickLabel(tMinC)} to ${tickLabel(tMaxC)} °C, ${lines.length} lines. Cursor at ${tickLabel(T_C)} °C.`;

  return (
    <div className="space-y-4">
      <div ref={wrapRef}>
        <Svg box={box} label={summary}>
          <PlotClip id={clipId} box={box} />
          <AxisLeft box={box} ticks={linearTicks(niceTicks(yMin, yMax, 6))} y={y} label="ΔG° (kJ per mol O₂)" />
          <AxisBottom box={box} ticks={linearTicks(niceTicks(tMinC, tMaxC, box.narrow ? 4 : 7))} x={x} label="Temperature (°C)" />
          {yMax > 0 && <line x1={box.x0} x2={box.x1} y1={y(0)} y2={y(0)} stroke={MUTED} strokeWidth={1.25} />}

          <g clipPath={`url(#${clipId})`}>
            {segments.map((s) => {
              if (!s.visible) return null;
              const st = styleOf(s.l, s.i);
              return (
                <line
                  key={s.i}
                  x1={x(s.a - ZERO_C_IN_K)}
                  y1={y(dG(s.l, s.a))}
                  x2={x(s.b - ZERO_C_IN_K)}
                  y2={y(dG(s.l, s.b))}
                  stroke={st.stroke}
                  strokeWidth={st.width}
                  strokeDasharray={st.dash}
                  strokeLinecap="round"
                >
                  <title>{s.l.label}</title>
                </line>
              );
            })}
            {rays.map((r) =>
              r.to > r.from ? (
                <line
                  key={r.key}
                  x1={x(r.from - ZERO_C_IN_K)}
                  y1={y(r.a + r.b * r.from)}
                  x2={x(r.to - ZERO_C_IN_K)}
                  y2={y(r.a + r.b * r.to)}
                  stroke={BRAND}
                  strokeWidth={1.75}
                  strokeDasharray={r.dash}
                />
              ) : null,
            )}
          </g>

          {segments.flatMap((s) =>
            s.visible
              ? (s.l.kinks ?? [])
                  .filter((k) => k.T_K >= s.a && k.T_K <= s.b)
                  .map((k, j) => {
                    const px = x(k.T_K - ZERO_C_IN_K);
                    const py = y(dG(s.l, k.T_K));
                    return (
                      <g key={`${s.i}-k${j}`}>
                        <circle cx={px} cy={py} r={4} fill={BG} stroke={styleOf(s.l, s.i).stroke} strokeWidth={1.75}>
                          <title>{`${k.label} (${tickLabel(Math.round(k.T_K))} K)`}</title>
                        </circle>
                        {!box.narrow && (
                          <text x={px + 6} y={py - 6} fontSize={11} fill={MUTED}>
                            {k.label}
                          </text>
                        )}
                      </g>
                    );
                  })
              : [],
          )}

          {[...endLabels.atEdge.map((l) => ({ ...l, x: box.x1 + 5 })), ...endLabels.inside].map((l) => (
            <text
              key={l.text}
              x={l.x}
              y={l.y}
              dy="0.32em"
              fontSize={12}
              fontWeight={l.strong ? 700 : 500}
              fill={l.color}
              stroke={BG}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {l.text}
            </text>
          ))}
          {/* On a phone the legend names the rays; labels here would cover the lines. */}
          {!box.narrow && rays.map((r) => {
            if (!(r.to > r.from)) return null;
            const e = rayEnd(r);
            const atRight = e.px >= box.x1 - 1;
            return (
              <text
                key={`${r.key}-label`}
                x={atRight ? e.px - 4 : e.px}
                y={atRight ? e.py - 6 : e.py - 6}
                textAnchor={atRight ? "end" : "middle"}
                fontSize={11.5}
                fontWeight={600}
                fill={BRAND}
                stroke={BG}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {r.label}
              </text>
            );
          })}

          {/* Temperature cursor and its crossings */}
          <line x1={cursorPx} x2={cursorPx} y1={box.y0} y2={box.y1} stroke={BRAND} strokeWidth={1.5} />
          {segments.map((s) =>
            s.visible && TK >= s.a && TK <= s.b ? (
              <circle key={`c${s.i}`} cx={cursorPx} cy={y(dG(s.l, TK))} r={3.5} fill={styleOf(s.l, s.i).stroke} stroke={BG} strokeWidth={1.25} />
            ) : null,
          )}
          <text
            x={Math.min(box.x1 - 2, Math.max(box.x0 + 2, cursorPx))}
            y={box.y0 + 12}
            textAnchor={cursorPx > box.x1 - 50 ? "end" : cursorPx < box.x0 + 50 ? "start" : "middle"}
            fontSize={12}
            fontWeight={600}
            fill={BRAND}
            stroke={BG}
            strokeWidth={3}
            paintOrder="stroke"
          >
            {`${tickLabel(Math.round(T_C))} °C`}
          </text>
          <DragSurface box={box} onX={(px) => setT(Math.round(xFromPx(px)))} />
        </Svg>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        ΔG° = A + B·T per mol O₂, standard state (unit activities, gases at 1 bar). More negative is lower: the lower a
        line, the more stable its oxide, and a reductant can reduce the oxides whose lines lie above its own. Drag across
        the plot or use the slider to move the temperature.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Temperature"
          value={T_C}
          min={tMinC}
          max={tMaxC}
          step={5}
          onChange={(v) => setT(Math.round(v))}
          display={`${tickLabel(Math.round(T_C))} °C (${tickLabel(Math.round(TK))} K)`}
        />
        {scales.pO2 && (
          <Slider
            label="Oxygen pressure, pO₂"
            value={logPO2}
            min={PO2_RANGE.min}
            max={PO2_RANGE.max}
            step={1}
            onChange={setPO2}
            display={`${pow10(logPO2)} bar`}
          />
        )}
        {scales.H2_H2O && hLine && (
          <Slider label="pH₂ / pH₂O" value={logH} min={RATIO_RANGE.min} max={RATIO_RANGE.max} step={0.25} onChange={setH} display={fmtFromLog10(logH)} />
        )}
        {scales.CO_CO2 && cLine && (
          <Slider label="pCO / pCO₂" value={logCO} min={RATIO_RANGE.min} max={RATIO_RANGE.max} step={0.25} onChange={setCO} display={fmtFromLog10(logCO)} />
        )}
      </div>

      <Readout>
        <p className="font-medium">
          At {tickLabel(Math.round(T_C))} °C ({tickLabel(Math.round(TK))} K):
        </p>
        {verdicts.length ? (
          <ul className="mt-1 space-y-1">
            {verdicts.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">Add a carbon or hydrogen line, or a scale, to compare reductants here.</p>
        )}
        {outOfRange.length > 0 && (
          <p className="mt-1 text-muted-foreground">
            Left out at this temperature, outside the range of their data: {listNames(outOfRange)}.
          </p>
        )}
      </Readout>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          {lines.map((l, i) => {
            const st = styleOf(l, i);
            return (
              <li key={l.label} className="flex items-center gap-1.5">
                <Swatch stroke={st.stroke} dash={st.dash} width={Math.min(3, st.width)} />
                <span className={highlight.has(l.label) ? "font-semibold text-foreground" : undefined}>{l.label}</span>
              </li>
            );
          })}
          {rays.map((r) => (
            <li key={r.key} className="flex items-center gap-1.5">
              <Swatch stroke={BRAND} dash={r.dash} width={1.75} />
              <span>{r.label.replace(" ", " = ")}</span>
            </li>
          ))}
        </ul>
        <ResetButton onClick={reset} />
      </div>

      {oxidesHere.length > 0 && (
        <details className="rounded-xl border border-border bg-background">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-foreground">
            Equilibrium values at {tickLabel(Math.round(T_C))} °C
          </summary>
          <div className="overflow-x-auto px-4 pb-3">
            <table className="w-full min-w-[22rem] text-left text-sm tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Oxide</th>
                  <th className="py-1.5 pr-3 font-medium">ΔG° (kJ)</th>
                  <th className="py-1.5 pr-3 font-medium">pO₂ (bar)</th>
                  {hLine && isValidAt(hLine, TK) && <th className="py-1.5 pr-3 font-medium">pH₂/pH₂O</th>}
                  {cLine && isValidAt(cLine, TK) && <th className="py-1.5 font-medium">pCO/pCO₂</th>}
                </tr>
              </thead>
              <tbody className="text-foreground">
                {oxidesHere.map((l) => (
                  <tr key={l.label} className="border-t border-border">
                    <td className="py-1.5 pr-3">{oxideName(l.label)}</td>
                    <td className="py-1.5 pr-3">{fmt(dG(l, TK), 4)}</td>
                    <td className="py-1.5 pr-3">{fmtFromLog10(equilibriumLog10PO2(l, TK))}</td>
                    {hLine && isValidAt(hLine, TK) && <td className="py-1.5 pr-3">{fmtFromLog10(equilibriumLog10Ratio(hLine, l, TK))}</td>}
                    {cLine && isValidAt(cLine, TK) && <td className="py-1.5">{fmtFromLog10(equilibriumLog10Ratio(cLine, l, TK))}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              Gas ratios are the minimum needed to reduce the oxide at this temperature; pO₂ is the pressure above which
              the metal oxidises.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
