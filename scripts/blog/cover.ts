/**
 * The article's thumbnail, drawn from its own interactive models.
 *
 * A cover is the blog card image and the LinkedIn/WhatsApp preview
 * (og:image falls back to it). Instead of a stock or generated picture, it
 * shows the article's real diagram (the Ellingham lines, the Pourbaix fields,
 * the simulated voltammogram) computed by the same reviewed widget code the
 * article uses, beside the title. Nothing on it is invented.
 *
 * renderCoverSvg() is pure and tested; coverWebp() rasterises with sharp,
 * because the media library accepts raster images only.
 */
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { parseWidget } from "../../apps/website/src/frontend/lib/widgets/schemas";
import { ZERO_C_IN_K, dG, oxideName, reductantOf, type EllinghamLine } from "../../apps/website/src/frontend/lib/widgets/ellingham-math";
import { behaviourOf, fields, hydrogenLineE, oxygenLineE, parseFormula, speciesTerm } from "../../apps/website/src/frontend/lib/widgets/pourbaix-math";
import { simulateCv } from "../../apps/website/src/frontend/lib/widgets/cv-sim";
import { compileExpr } from "../../apps/website/src/frontend/lib/widgets/expr";

export const COVER_W = 1600;
export const COVER_H = 900;

const C = {
  bg: "#f7f7f8",
  panel: "#ffffff",
  ink: "#16181d",
  muted: "#5d6470",
  grid: "#e3e5e9",
  brand: "#d9262f", // --brand, hsl(357 74% 49%)
  series: ["#0072b2", "#d55e00", "#008f68", "#b8558f", "#a86400", "#6a3d9a", "#7d6418", "#1f8a93"],
  immunity: "#008f68",
  corrosion: "#d55e00",
  passivation: "#0072b2",
};
const FONT = "DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lin = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) * (r1 - r0)) / (d1 - d0);
type Box = { x: number; y: number; w: number; h: number };

/** Greedy word wrap by an average glyph width; good enough for a title. */
export function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if (!cur) cur = word;
    else if ((cur + " " + word).length <= maxChars) cur += " " + word;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    // Make room for the ellipsis only if the line has none.
    if (last.length + 1 > maxChars && /\s/.test(last)) last = last.replace(/\s+\S*$/, "");
    kept[maxLines - 1] = last.replace(/[\s,;:–—-]+$/, "") + "…";
    return kept;
  }
  return lines;
}

function frame(b: Box, title: string, inner: string, xLabel: string, yLabel: string): string {
  return [
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="18" fill="${C.panel}" stroke="${C.grid}" stroke-width="2"/>`,
    `<text x="${b.x + 28}" y="${b.y + 44}" font-size="24" font-weight="700" fill="${C.ink}">${esc(title)}</text>`,
    inner,
    `<text x="${b.x + b.w / 2}" y="${b.y + b.h - 16}" font-size="18" fill="${C.muted}" text-anchor="middle">${esc(xLabel)}</text>`,
    `<text transform="translate(${b.x + 22},${b.y + b.h / 2 + 20}) rotate(-90)" font-size="18" fill="${C.muted}" text-anchor="middle">${esc(yLabel)}</text>`,
  ].join("");
}
const plotArea = (b: Box): Box => ({ x: b.x + 56, y: b.y + 66, w: b.w - 84, h: b.h - 116 });

/** Moves labels apart vertically so none overlap, keeping them inside [top, bottom]. */
function spread(items: { y: number }[], gap: number, top: number, bottom: number): void {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i++) if (s[i]!.y < s[i - 1]!.y + gap) s[i]!.y = s[i - 1]!.y + gap;
  for (let i = s.length - 1; i >= 0; i--) {
    const limit = i === s.length - 1 ? bottom : s[i + 1]!.y - gap;
    if (s[i]!.y > limit) s[i]!.y = limit;
  }
  for (const it of s) if (it.y < top) it.y = top;
}

function ellinghamPanel(b: Box, lines: EllinghamLine[], rangeC: [number, number]): string {
  // A column on the right for the line names, so they never sit on the lines.
  const full = plotArea(b);
  const p = { ...full, w: full.w - 120 };
  const [t0, t1] = rangeC;
  const K0 = t0 + ZERO_C_IN_K;
  const K1 = t1 + ZERO_C_IN_K;
  let lo = 0;
  for (const l of lines) for (const T of [Math.max(l.validFromK, K0), Math.min(l.validToK, K1)]) lo = Math.min(lo, dG(l, T));
  const yMin = Math.floor(lo / 200) * 200;
  const x = lin(t0, t1, p.x, p.x + p.w);
  const y = lin(0, yMin, p.y, p.y + p.h); // ΔG° more negative DOWNWARDS, as in the textbooks
  const grid = [0, yMin / 2, yMin].map((g) => `<line x1="${p.x}" x2="${p.x + p.w}" y1="${y(g)}" y2="${y(g)}" stroke="${C.grid}" stroke-width="2"/>`).join("");
  let oxideIdx = 0;
  const labels: { y: number; text: string; color: string }[] = [];
  const paths = lines
    .map((l) => {
      const a = Math.max(l.validFromK, K0);
      const z = Math.min(l.validToK, K1);
      if (z <= a) return "";
      const r = reductantOf(l.label);
      const color = r ? C.ink : C.series[oxideIdx++ % C.series.length]!;
      const dash = r === "CO" ? ' stroke-dasharray="14 9"' : r === "H2" ? ' stroke-dasharray="4 8"' : "";
      labels.push({ y: y(dG(l, z)), text: r ? (r === "C" ? `C→${oxideName(l.label)}` : r === "CO" ? "CO→CO₂" : "H₂→H₂O") : oxideName(l.label), color });
      return `<line x1="${x(a - ZERO_C_IN_K)}" y1="${y(dG(l, a))}" x2="${x(z - ZERO_C_IN_K)}" y2="${y(dG(l, z))}" stroke="${color}" stroke-width="${r ? 4 : 5}" stroke-linecap="round"${dash}/>`;
    })
    .join("");
  spread(labels, 24, p.y + 8, p.y + p.h);
  const names = labels
    .map((t) => `<text x="${p.x + p.w + 14}" y="${t.y + 6}" font-size="18" font-weight="700" fill="${t.color}">${esc(t.text)}</text>`)
    .join("");
  return frame(b, "Ellingham diagram", grid + paths + names, "Temperature (°C)", "ΔG° per mol O₂");
}

function pourbaixPanel(b: Box, cfg: Extract<ReturnType<typeof parseWidget>, { ok: true }>["value"] & { widget: "pourbaix" }): string {
  const c = cfg.config;
  const p = plotArea(b);
  const terms = c.species.map((sp) => speciesTerm(sp, parseFormula(sp.formula, c.element) as Exclude<ReturnType<typeof parseFormula>, string>, c.logActivity.default));
  const regions = fields(terms, c.pHRange, c.ERange_V);
  const x = lin(c.pHRange[0], c.pHRange[1], p.x, p.x + p.w);
  const y = lin(c.ERange_V[0], c.ERange_V[1], p.y + p.h, p.y);
  const polys = regions
    .map((r) => {
      const fill = C[behaviourOf(c.species[r.index]!, c.element)];
      const pts = r.polygon.map((q) => `${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join(" ");
      return `<polygon points="${pts}" fill="${fill}" fill-opacity="0.24" stroke="${C.ink}" stroke-opacity="0.7" stroke-width="2.5" stroke-linejoin="round"/>`;
    })
    .join("");
  const area = (c.pHRange[1] - c.pHRange[0]) * (c.ERange_V[1] - c.ERange_V[0]);
  const labels = regions
    .filter((r) => (r.area / area) * p.w * p.h > 5000)
    .map((r) => `<text x="${x(r.centroid[0])}" y="${y(r.centroid[1]) + 8}" font-size="24" font-weight="700" fill="${C.ink}" text-anchor="middle" stroke="${C.panel}" stroke-width="5" paint-order="stroke">${esc(c.species[r.index]!.label)}</text>`)
    .join("");
  const water = c.showWaterLines
    ? [hydrogenLineE, oxygenLineE].map((f) => `<line x1="${x(c.pHRange[0])}" y1="${y(f(c.pHRange[0]))}" x2="${x(c.pHRange[1])}" y2="${y(f(c.pHRange[1]))}" stroke="${C.muted}" stroke-width="3" stroke-dasharray="12 8"/>`).join("")
    : "";
  return frame(b, `Pourbaix diagram, ${c.element}`, `<g clip-path="url(#clip-${b.y})"><clipPath id="clip-${b.y}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath>${polys}${water}</g>${labels}`, "pH", "E (V vs SHE)");
}

function curvePanel(b: Box, title: string, pts: [number, number][][], xLabel: string, yLabel: string): string {
  const p = plotArea(b);
  const all = pts.flat().filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
  if (!all.length) return frame(b, title, "", xLabel, yLabel);
  const xs = all.map((q) => q[0]);
  const ys = all.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = (y1 - y0 || 1) * 0.08;
  const x = lin(x0, x1 === x0 ? x0 + 1 : x1, p.x, p.x + p.w);
  const y = lin(y0 - pad, y1 + pad, p.y + p.h, p.y);
  const zero = y0 < 0 && y1 > 0 ? `<line x1="${p.x}" x2="${p.x + p.w}" y1="${y(0)}" y2="${y(0)}" stroke="${C.grid}" stroke-width="2"/>` : "";
  const lines = pts
    .map((series, i) => {
      const d = series.filter((q) => Number.isFinite(q[1])).map((q, k) => `${k ? "L" : "M"}${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join("");
      return `<path d="${d}" fill="none" stroke="${C.series[i % C.series.length]}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join("");
  return frame(b, title, zero + lines, xLabel, yLabel);
}

function widgetPanel(b: Box, widget: string, config: unknown): string | null {
  const r = parseWidget(widget, config);
  if (!r.ok) return null;
  const v = r.value;
  if (v.widget === "ellingham") return ellinghamPanel(b, v.config.lines as EllinghamLine[], v.config.temperatureRangeC);
  if (v.widget === "pourbaix") return pourbaixPanel(b, v);
  if (v.widget === "cyclic-voltammetry") {
    const c = v.config;
    const curve = simulateCv({ mechanism: c.mechanism, n: c.n, E0_V: c.E0_V, k0_cm_s: c.k0_cm_s, alpha: c.alpha, D_cm2_s: c.D_cm2_s, C_mM: c.C_mM, area_cm2: c.area_cm2, scanRate_V_s: c.scanRate_V_s.default, window_V: c.window_V, kc_s: c.kc_s });
    const step = Math.max(1, Math.floor(curve.E.length / 600));
    const pts: [number, number][] = [];
    for (let i = 0; i < curve.E.length; i += step) pts.push([curve.E[i]!, curve.I_uA[i]!]);
    return curvePanel(b, "Cyclic voltammogram (simulated)", [pts], `E, V ${c.ref}`, "Current (µA)");
  }
  if (v.widget === "function-plot") {
    const c = v.config;
    const vars: Record<string, number> = Object.fromEntries(c.params.map((q) => [q.symbol, q.default]));
    const series = c.curves.map((cv) => {
      const f = compileExpr(cv.expr, [c.x.symbol, ...c.params.map((q) => q.symbol)]);
      const out: [number, number][] = [];
      if (!f.ok) return out;
      for (let i = 0; i <= 200; i++) {
        const xv = c.x.min + ((c.x.max - c.x.min) * i) / 200;
        out.push([xv, f.fn({ ...vars, [c.x.symbol]: xv })]);
      }
      return out;
    });
    return curvePanel(b, c.curves.map((q) => q.label).slice(0, 2).join(" · "), series, `${c.x.label}${c.x.unit ? ` (${c.x.unit})` : ""}`, `${c.y.label}${c.y.unit ? ` (${c.y.unit})` : ""}`);
  }
  return null;
}

/** The cover as SVG text: title on the left, up to two of the article's models on the right. */
export function renderCoverSvg(a: { title: string; kicker?: string; widgets: { widget: string; config: unknown }[] }): string {
  const panels = a.widgets.slice(0, 2);
  const right: Box = { x: 760, y: 60, w: 780, h: 780 };
  const boxes: Box[] =
    panels.length === 2
      ? [
          { ...right, h: 380 },
          { ...right, y: right.y + 400, h: 380 },
        ]
      : [right];
  const drawn = panels.map((w, i) => widgetPanel(boxes[i]!, w.widget, w.config)).filter(Boolean);
  // The text column ends at x≈730. GitHub's runner draws in DejaVu Sans Bold, about 0.66 em per
  // character (wider than Arial), so the wrap width is chosen for that font, not the narrower
  // ones on a laptop: the first live cover lost "Decide" under the diagram panel.
  const TEXT_W = 650;
  let size = 58;
  let titleLines = wrap(a.title, Math.floor(TEXT_W / (0.66 * size)), 5);
  if (titleLines.length > 4) {
    size = 50;
    titleLines = wrap(a.title, Math.floor(TEXT_W / (0.66 * size)), 5);
  }
  const title = titleLines.map((l, i) => `<text x="80" y="${300 + i * (size + 14)}" font-size="${size}" font-weight="700" fill="${C.ink}">${esc(l)}</text>`).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_W}" height="${COVER_H}" viewBox="0 0 ${COVER_W} ${COVER_H}" font-family="${FONT}">`,
    `<rect width="${COVER_W}" height="${COVER_H}" fill="${C.bg}"/>`,
    `<rect x="0" y="0" width="16" height="${COVER_H}" fill="${C.brand}"/>`,
    `<text x="80" y="140" font-size="26" font-weight="700" letter-spacing="4" fill="${C.brand}">METNMAT INSIGHTS</text>`,
    a.kicker ? `<text x="80" y="190" font-size="26" fill="${C.muted}">${esc(a.kicker)}</text>` : "",
    title,
    drawn.length ? `<text x="80" y="800" font-size="24" fill="${C.muted}">Interactive ${drawn.length > 1 ? "models" : "model"} inside · metnmat.com/blog</text>` : "",
    ...drawn,
    `</svg>`,
  ].join("");
}

/** Rasterises the SVG to WebP with sharp, resolved from the CMS package where it is installed. */
export async function coverWebp(svg: string): Promise<Buffer> {
  let dir = process.cwd();
  while (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error("not inside the monorepo");
    dir = up;
  }
  // sharp lives in the CMS package, so its types are not visible from here: just the call used.
  type Sharp = (input: Buffer) => { webp(o: { quality: number }): { toBuffer(): Promise<Buffer> } };
  const sharp = createRequire(path.join(dir, "apps/dashboard/package.json"))("sharp") as Sharp;
  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}
