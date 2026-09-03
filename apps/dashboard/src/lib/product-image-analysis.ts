/**
 * Subject-aware composition analysis for product photographs.
 *
 * Product photos are objects on a broadly uniform studio background (white
 * table, grey curtain — sometimes both in one frame). Classical analysis is
 * reliable here without any ML dependency:
 *
 *   1. TILT — a magnitude-weighted histogram of gradient orientations finds
 *      the small camera tilt shared by the scene's near-axis structure (table
 *      edge, product edges). Only a confident, slight tilt (0.4°–8°) is
 *      corrected; a deliberate three-quarter angle never qualifies.
 *   2. BACKGROUND — the border is sampled per side, in thirds, and the
 *      samples are clustered tightly. A cluster must be supported by two
 *      segments to count as background, so a split scene (grey curtain above
 *      a white table) yields two clusters and a subject crossing one border
 *      edge cannot poison the estimate.
 *   3. SUBJECT — foreground pixels group into connected components. The
 *      strongest central one is the product; nearby pieces join by proximity
 *      and distant-but-substantial ones by mass, both gated on contrast
 *      depth. A weaker threshold then grows the region outward so faint
 *      attached parts extend the boundary instead of being cut.
 *   4. BOUNDARY SAFETY — every edge of the resulting box is tested against
 *      the sensitive mask. An edge running through material is a cut, not a
 *      boundary, and moves outward until it comes up clean.
 *
 * From the subject box the planner lays the DISPLAY window: the smallest 4:3
 * window that holds the subject plus breathing room (only a hair margin on
 * sides where the subject already runs out of the photograph), positioned so
 * the subject sits optically centred on the canvas. Whatever the photo cannot
 * supply of that window is synthesised by stretching the crop's own edge and
 * washing it toward the scene's background — continuation, seam-free by
 * construction. Only background is ever cropped; nothing is distorted;
 * upscaling is capped.
 *
 * The ordering principle throughout: every step above can be wrong at the
 * margin, so where tightness and wholeness conflict, wholeness wins. A frame
 * with too much background is untidy; a frame with the product's connectors
 * sliced off is wrong.
 *
 * Pure geometry + raw-pixel math, unit-tested from test/ at the repo root.
 */
import sharp from "sharp";

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Sides<T> = { left: T; right: T; top: T; bottom: T };
export type RGB = { r: number; g: number; b: number };

export type SubjectAnalysis = {
  /** Image dimensions after EXIF orientation AND tilt correction. */
  width: number;
  height: number;
  /** Rotation (degrees, sharp convention) that straightens the photo; 0 = none. */
  tiltDeg: number;
  /** Dominant border colour — rotation fill and the planner's fallback tone. */
  background: RGB;
  /** Subject bounding box in corrected full-resolution pixel coordinates. */
  box: Box;
  /** Sides where the subject reaches the frame edge (already cut by the photo). */
  touches: Sides<boolean>;
  /** Subject centroid as percentages (Payload focalX/focalY convention). */
  focalX: number;
  focalY: number;
  /** Fraction of the image area the subject box covers (0..1). */
  coverage: number;
  /** False when detection was degenerate and callers should fall back. */
  confident: boolean;
};

export type DisplayPlan = {
  /** Subject box in source-image coordinates, when detection was confident. */
  subject?: Box;
  /** Tilt correction to apply before extracting (degrees; 0 = skip). */
  rotate: number;
  /** Fill colour for the corners a rotation exposes. */
  background: RGB;
  /** Region of the corrected image to extract (full-resolution pixels). */
  crop: { left: number; top: number; width: number; height: number };
  /** The extracted region's target size on the output canvas. */
  scaled: { width: number; height: number };
  /** Fixed output canvas (always 4:3). */
  out: { width: number; height: number };
  /** Where the scaled region lands on the canvas (subject optically centred). */
  place: { left: number; top: number };
  /** Why this plan was chosen — "subject" or a fallback reason. */
  mode: "subject" | "whole-image";
};

export const DISPLAY_SIZE = { width: 1600, height: 1200 } as const;
const RATIO = DISPLAY_SIZE.width / DISPLAY_SIZE.height; // 4:3
/** Upscale cap for the extracted region — past ~2× photos turn to mush. */
const MAX_SCALE = 2;
/**
 * The catalogue standard. Whichever of the subject's dimensions binds first
 * occupies this much of the canvas along that axis, so every product is
 * presented at the same visual weight inside the same clear margin.
 */
const SUBJECT_OCCUPANCY = 0.72;
/** Analysis raster bound — enough signal for thin parts, still trivial cost. */
const ANALYSIS_SIZE = 256;
/** Colour-distance band for "this pixel is not background". */
const BG_THRESHOLD_FLOOR = 24;
/**
 * Ceiling on that tolerance. A pale product against a white table is only
 * ~40 apart in RGB, so anything wider stops separating them at all.
 */
const BG_THRESHOLD_CEILING = 38;
/** Border segments merge into one background cluster within this distance. */
const CLUSTER_RADIUS = 16;
/** Merge components whose boxes come within this fraction of the diagonal. */
const ATTACH_GAP_FRACTION = 0.035;
/**
 * Where a subject's edge lies: the share of the subject's own contrast energy
 * that may be trimmed from each end of an axis. Relative, never an absolute
 * count — a dark steel pump head and a white PTFE cell differ by an order of
 * magnitude in depth, and one fixed threshold is wrong for one of them.
 */
const EDGE_ENERGY_FRACTION = 0.02;
/**
 * Contrast depth at which a pixel counts as fully "material" in the edge
 * profiles. Depth is *saturated* at this value rather than summed raw, so a
 * purple glove and the pale cell it holds weigh the same per pixel — summing
 * raw depth lets the highest-contrast object in the frame decide the crop, and
 * that is what once framed a hand and cut the product it was holding in half.
 */
const SUBJECT_DEPTH = 12;
/**
 * Rejoin bar: what an adjacent line must carry, over the scene's own level, to
 * be pulled back inside the box. Measured against the SCENE, not against the
 * product's bulk — a 14 px electrode pin is a hundredth of the line a 380 px
 * body fills, so any bar set as a share of the body's line discards exactly
 * the thin parts that must survive. Reach is capped so it stays a repair.
 */
const REJOIN_FLOOR = 0.006;
const REJOIN_FRACTION = 0.03;
const REJOIN_REACH = 0.25;
/** Region growing through the weak mask stops after this fraction of the diagonal. */
const GROW_DEPTH_FRACTION = 0.2;
/** Tilt is corrected only inside this window — beyond it the angle is a choice. */
const TILT_MIN = 0.4;
const TILT_MAX = 8;
/** How far the optical centre is pulled from the subject box toward its mass. */
const MASS_PULL = 0.4;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export type Raster = { data: Buffer; width: number; height: number };

/** Decode for analysis: EXIF-corrected, alpha flattened white, bounded raster. */
export async function decodeAnalysisRaster(input: Buffer): Promise<{ raster: Raster; fullW: number; fullH: number }> {
  const src = sharp(input).rotate();
  const meta = await src.metadata();
  const turned = (meta.orientation ?? 1) >= 5;
  const fullW = (turned ? meta.height : meta.width) ?? 0;
  const fullH = (turned ? meta.width : meta.height) ?? 0;
  const { data, info } = await src
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "inside", withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { raster: { data, width: info.width, height: info.height }, fullW, fullH };
}

/** Rotate a small raw raster by `deg` (sharp convention), filled with `bg`. */
async function rotateRaster(r: Raster, deg: number, bg: RGB): Promise<Raster> {
  const { data, info } = await sharp(r.data, { raw: { width: r.width, height: r.height, channels: 3 } })
    .rotate(deg, { background: { ...bg, alpha: 1 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Estimate the scene's tilt from near-axis gradient orientation. Returns the
 * angle to hand to sharp's rotate() to straighten the photo, or 0 when there
 * is no confident, slight, coherent deviation to correct.
 */
export function estimateTilt(r: Raster): number {
  const { data, width: w, height: h } = r;
  if (w < 32 || h < 32) return 0;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 3]! + 0.587 * data[i * 3 + 1]! + 0.114 * data[i * 3 + 2]!;
  }
  const BAND = 12; // degrees either side of an axis that still counts as "slight"
  const BIN = 0.25;
  const bins = new Float32Array(Math.round((2 * BAND) / BIN) + 1);
  let bandMass = 0;
  let totalMass = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        gray[i - w + 1]! + 2 * gray[i + 1]! + gray[i + w + 1]! -
        gray[i - w - 1]! - 2 * gray[i - 1]! - gray[i + w - 1]!;
      const gy =
        gray[i + w - 1]! + 2 * gray[i + w]! + gray[i + w + 1]! -
        gray[i - w - 1]! - 2 * gray[i - w]! - gray[i - w + 1]!;
      const mag = Math.hypot(gx, gy);
      if (mag < 80) continue; // weak texture — not structure
      totalMass += mag;
      // Deviation of this edge from the nearest axis, in (-45, 45].
      let d = (Math.atan2(gy, gx) * 180) / Math.PI;
      d = ((d % 90) + 90) % 90;
      if (d > 45) d -= 90;
      if (Math.abs(d) > BAND) continue;
      bandMass += mag;
      bins[Math.round((d + BAND) / BIN)]! += mag;
    }
  }
  if (!totalMass || bandMass / totalMass < 0.22) return 0; // no near-axis structure dominates

  // Smooth, find the peak, refine it as the weighted mean of its ±1° window.
  const smooth = bins.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = -2; k <= 2; k++) {
      const j = i + k;
      if (j < 0 || j >= bins.length) continue;
      const wgt = 3 - Math.abs(k);
      s += bins[j]! * wgt;
      n += wgt;
    }
    return s / n;
  });
  let peak = 0;
  for (let i = 1; i < smooth.length; i++) if (smooth[i]! > smooth[peak]!) peak = i;
  const win = Math.round(1 / BIN);
  let mass = 0;
  let moment = 0;
  for (let i = Math.max(0, peak - win); i <= Math.min(bins.length - 1, peak + win); i++) {
    mass += bins[i]!;
    moment += bins[i]! * (i * BIN - BAND);
  }
  if (!mass || mass / bandMass < 0.3) return 0; // smeared, not one coherent angle
  const angle = moment / mass;
  if (Math.abs(angle) < TILT_MIN || Math.abs(angle) > TILT_MAX) return 0;
  // Gradient math above measures orientation in image coordinates (y down);
  // sharp's rotate(angle) turns the content clockwise on screen, which cancels
  // a content orientation of +angle measured that way. The sign is pinned by a
  // unit test that straightens a synthetically tilted rectangle.
  return -angle;
}

type BgCluster = { color: [number, number, number]; threshold: number; weight: number };

const colorDist = (a: readonly number[], b: readonly number[]): number =>
  Math.sqrt((a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2);

/** Value below which `q` of the sample lies (linear index, no interpolation). */
const quantile = (values: number[], q: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[clamp(Math.floor(q * (sorted.length - 1)), 0, sorted.length - 1)]!;
};

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

/**
 * Model the background as colour clusters sampled from the border, one median
 * per side-third. A cluster needs ≥2 supporting segments — a subject crossing
 * one stretch of border cannot register its own colour as "background".
 */
export function estimateBackground(r: Raster): { clusters: BgCluster[]; dominant: RGB } {
  const { data, width: w, height: h } = r;
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const px = (x: number, y: number): [number, number, number] => {
    const o = (y * w + x) * 3;
    return [data[o]!, data[o + 1]!, data[o + 2]!];
  };

  // 12 border segments: each side sampled in thirds.
  const segments: [number, number, number][][] = [];
  const seg = (xs: number, xe: number, ys: number, ye: number): void => {
    const s: [number, number, number][] = [];
    for (let y = ys; y < ye; y++) for (let x = xs; x < xe; x++) s.push(px(x, y));
    if (s.length) segments.push(s);
  };
  for (let k = 0; k < 3; k++) {
    const x0 = Math.floor((w * k) / 3);
    const x1 = Math.floor((w * (k + 1)) / 3);
    const y0 = Math.floor((h * k) / 3);
    const y1 = Math.floor((h * (k + 1)) / 3);
    seg(x0, x1, 0, t); // top
    seg(x0, x1, h - t, h); // bottom
    seg(0, t, y0, y1); // left
    seg(w - t, w, y0, y1); // right
  }

  const medians = segments.map(
    (s) =>
      [median(s.map((p) => p[0])), median(s.map((p) => p[1])), median(s.map((p) => p[2]))] as [
        number,
        number,
        number,
      ]
  );

  // Greedy clustering of segment medians. The radius is deliberately tight: a
  // lit backdrop shades across the frame, and one loose cluster spanning that
  // whole ramp needs so wide a tolerance that a pale product falls inside it.
  // Several tight clusters describe the same ramp without that cost.
  const groups: { color: [number, number, number]; members: number[] }[] = [];
  medians.forEach((m, i) => {
    const g = groups.find((g) => colorDist(g.color, m) < CLUSTER_RADIUS);
    if (g) {
      g.members.push(i);
      const n = g.members.length;
      g.color = [
        g.color[0] + (m[0] - g.color[0]) / n,
        g.color[1] + (m[1] - g.color[1]) / n,
        g.color[2] + (m[2] - g.color[2]) / n,
      ];
    } else {
      groups.push({ color: m, members: [i] });
    }
  });

  const supported = groups.filter((g) => g.members.length >= 2);
  const usable = supported.length ? supported : groups; // degenerate border: keep everything
  const clusters = usable.map((g) => {
    const dists: number[] = [];
    for (const i of g.members) for (const p of segments[i]!) dists.push(colorDist(p, g.color));
    // Robust spread. mean + kσ is the obvious estimator and the wrong one: a
    // shaded backdrop or a curtain fold drags the tail, σ balloons, and the
    // tolerance grows until the product itself is "background" — which is
    // exactly how a cream cell body on a grey-to-white scene disappeared.
    // The median absolute deviation ignores that tail, and the ceiling keeps
    // even a genuinely noisy border from opening the door that wide.
    const med = median(dists);
    const mad = median(dists.map((d) => Math.abs(d - med)));
    return {
      color: g.color,
      threshold: clamp(med + 2.5 * 1.4826 * mad, BG_THRESHOLD_FLOOR, BG_THRESHOLD_CEILING),
      weight: g.members.length,
    };
  });
  const top = [...clusters].sort((a, b) => b.weight - a.weight)[0]!;
  return {
    clusters,
    dominant: { r: Math.round(top.color[0]), g: Math.round(top.color[1]), b: Math.round(top.color[2]) },
  };
}

/** Distance from a colour to the RGB segment between two cluster colours. */
function segmentDist(p: readonly number[], a: readonly number[], b: readonly number[]): number {
  const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  const ap = [p[0]! - a[0]!, p[1]! - a[1]!, p[2]! - a[2]!];
  const len2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2;
  const t = len2 ? clamp((ap[0]! * ab[0]! + ap[1]! * ab[1]! + ap[2]! * ab[2]!) / len2, 0, 1) : 0;
  return Math.hypot(ap[0]! - t * ab[0]!, ap[1]! - t * ab[1]!, ap[2]! - t * ab[2]!);
}

/**
 * Foreground masks: strong (subject) and weak (faint attached structure),
 * plus `excess` — how far each pixel clears the nearest background tolerance.
 * That depth is what separates a product part from a patch of backdrop that
 * merely drifted past the threshold, and the component logic leans on it.
 */
export function buildMasks(
  r: Raster,
  clusters: BgCluster[]
): { strong: Uint8Array; weak: Uint8Array; excess: Float32Array } {
  const { data, width: w, height: h } = r;
  const strong = new Uint8Array(w * h);
  const weak = new Uint8Array(w * h);
  const excess = new Float32Array(w * h);
  // A soft transition between two background regions (a grey curtain fading
  // into a white table) mixes their colours, so pixels on the segment joining
  // two cluster colours are background too — otherwise every split scene
  // grows a foreground stripe along the boundary.
  //
  // The guard matters more than the rule. Two neutral backgrounds define a
  // line along the grey axis, and a warm product (cream PEEK, beige ferrules)
  // sits near that line in plain RGB distance — suppressing it swallows the
  // product where the light is brightest. So a pixel is only forgiven by this
  // rule when its CHROMA also matches the backgrounds': tone may be anywhere
  // between them, colourfulness may not exceed theirs by more than a hair.
  const chroma = (p: readonly number[]): number =>
    Math.max(p[0]!, p[1]!, p[2]!) - Math.min(p[0]!, p[1]!, p[2]!);
  const CHROMA_SLACK = 8;
  const pairs: {
    a: [number, number, number];
    b: [number, number, number];
    strongT: number;
    weakT: number;
    maxChroma: number;
  }[] = [];
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const tMin = Math.min(clusters[i]!.threshold, clusters[j]!.threshold);
      pairs.push({
        a: clusters[i]!.color,
        b: clusters[j]!.color,
        strongT: Math.max(16, tMin * 0.55),
        weakT: Math.max(11, tMin * 0.4),
        maxChroma: Math.max(chroma(clusters[i]!.color), chroma(clusters[j]!.color)) + CHROMA_SLACK,
      });
    }
  }
  for (let i = 0; i < w * h; i++) {
    const p = [data[i * 3]!, data[i * 3 + 1]!, data[i * 3 + 2]!];
    let minStrong = Infinity;
    let minWeak = Infinity;
    for (const c of clusters) {
      const d = colorDist(p, c.color);
      minStrong = Math.min(minStrong, d - c.threshold);
      minWeak = Math.min(minWeak, d - Math.max(14, c.threshold * 0.55));
    }
    const pChroma = chroma(p);
    for (const pr of pairs) {
      if (pChroma > pr.maxChroma) continue; // too colourful to be their blend
      const d = segmentDist(p, pr.a, pr.b);
      minStrong = Math.min(minStrong, d - pr.strongT);
      minWeak = Math.min(minWeak, d - pr.weakT);
    }
    if (minStrong > 0) strong[i] = 1;
    if (minWeak > 0) weak[i] = 1;
    excess[i] = Math.max(0, minStrong);
  }
  // Despeckle the strong mask: a foreground pixel needs 2 foreground neighbours.
  const clean = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!strong[i]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && strong[ny * w + nx]) n++;
        }
      }
      if (n >= 2) clean[i] = 1;
    }
  }
  return { strong: clean, weak, excess };
}

type Component = { box: Box; area: number; depth: number };

/**
 * Connected components (8-connectivity) of a binary mask. `depth` is the
 * component's mean contrast excess over background — near zero for a patch of
 * backdrop that merely drifted past the threshold, substantial for anything
 * actually sitting on the table.
 */
export function findComponents(
  mask: Uint8Array,
  w: number,
  h: number,
  excess?: Float32Array
): { components: Component[]; labels: Int32Array } {
  const labels = new Int32Array(w * h).fill(-1);
  const components: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const id = components.length;
    const box: Box = { x0: w, y0: h, x1: 0, y1: 0 };
    let area = 0;
    let depthSum = 0;
    stack.push(start);
    labels[start] = id;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i / w) | 0;
      area++;
      depthSum += excess ? excess[i]! : 1;
      box.x0 = Math.min(box.x0, x);
      box.y0 = Math.min(box.y0, y);
      box.x1 = Math.max(box.x1, x + 1);
      box.y1 = Math.max(box.y1, y + 1);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (mask[j] && labels[j] === -1) {
            labels[j] = id;
            stack.push(j);
          }
        }
      }
    }
    components.push({ box, area, depth: depthSum / Math.max(1, area) });
  }
  return { components, labels };
}

/** Axis-aligned gap between two boxes (0 when they touch or overlap). */
const boxGap = (a: Box, b: Box): number => {
  const dx = Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const dy = Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  return Math.max(dx, dy);
};

/**
 * Detect the subject of a photograph. Returns `confident: false` (with a
 * whole-image box) when the scene doesn't behave like a subject on a studio
 * background — busy scenes, full-bleed subjects, unreadable files.
 */
export async function analyzeSubject(input: Buffer): Promise<SubjectAnalysis> {
  const whole = (w: number, h: number, tilt = 0, bg: RGB = { r: 255, g: 255, b: 255 }): SubjectAnalysis => ({
    width: w,
    height: h,
    tiltDeg: tilt,
    background: bg,
    box: { x0: 0, y0: 0, x1: w, y1: h },
    touches: { left: true, right: true, top: true, bottom: true },
    focalX: 50,
    focalY: 50,
    coverage: 1,
    confident: false,
  });

  let fullW = 0;
  let fullH = 0;
  try {
    const decoded = await decodeAnalysisRaster(input);
    fullW = decoded.fullW;
    fullH = decoded.fullH;
    if (!fullW || !fullH) return whole(0, 0);
    let raster = decoded.raster;
    if (raster.width < 16 || raster.height < 16) return whole(fullW, fullH);

    // Tilt first — every later measurement runs on the straightened raster.
    const preBg = estimateBackground(raster).dominant;
    const tilt = estimateTilt(raster);
    const rasterScale = fullW / raster.width;
    if (tilt !== 0) {
      raster = await rotateRaster(raster, tilt, preBg);
      // Corrected full-res dimensions mirror the raster's expansion.
      fullW = Math.round(raster.width * rasterScale);
      fullH = Math.round(raster.height * rasterScale);
    }
    const { clusters, dominant } = estimateBackground(raster);
    const w = raster.width;
    const h = raster.height;
    const { strong, weak, excess } = buildMasks(raster, clusters);

    const { components, labels } = findComponents(strong, w, h, excess);
    const diag = Math.hypot(w, h);
    if (!components.length) return whole(fullW, fullH, tilt, dominant);

    // A residual boundary artefact — a near-full-frame sliver (curtain edge,
    // table lip) — is scenery, not subject: never primary, never merged.
    const isSliver = (c: Component): boolean => {
      const cw = c.box.x1 - c.box.x0;
      const ch = c.box.y1 - c.box.y0;
      return (cw > 0.9 * w && ch < 0.05 * h) || (ch > 0.9 * h && cw < 0.05 * w);
    };

    // The product: strongest component, weighted by how far it stands clear of
    // the background and biased toward central mass. Weighting by area alone
    // lets a broad, barely-suprathreshold wash of backdrop outvote the product.
    const score = (c: Component): number => {
      if (isSliver(c)) return -1;
      const cx = (c.box.x0 + c.box.x1) / 2 - w / 2;
      const cy = (c.box.y0 + c.box.y1) / 2 - h / 2;
      return c.area * Math.min(1, c.depth / 12) * (1 - 0.45 * (Math.hypot(cx, cy) / (diag / 2)));
    };
    let primaryIdx = 0;
    components.forEach((c, i) => {
      if (score(c) > score(components[primaryIdx]!)) primaryIdx = i;
    });
    const primary = components[primaryIdx]!;
    let strongMass = 0;
    for (let i = 0; i < w * h; i++) if (strong[i]) strongMass++;
    if (primary.area < 0.005 * w * h) return whole(fullW, fullH, tilt, dominant);

    // Merge components into the subject; far clutter stays out. Two rules:
    //  - proximity: parts sitting close to the subject (attached probes,
    //    cables, tape) belong to it — iterated, since each merge can bring
    //    the next piece into range;
    //  - mass: a component with real weight (≥8% of the primary) AND real
    //    contrast is part of the SETUP even across a distance — a rig of
    //    pumps, bottles and a cell on a pale table fragments into islands,
    //    and a crop keeping only one island would cut the product in half.
    //    The contrast condition is what keeps a broad, faint patch of lit
    //    backdrop from qualifying on size alone and swallowing the frame.
    const merged = new Set<number>([primaryIdx]);
    const box: Box = { ...primary.box };
    const attachGap = ATTACH_GAP_FRACTION * diag;
    const absorb = (i: number, c: Component): void => {
      merged.add(i);
      box.x0 = Math.min(box.x0, c.box.x0);
      box.y0 = Math.min(box.y0, c.box.y0);
      box.x1 = Math.max(box.x1, c.box.x1);
      box.y1 = Math.max(box.y1, c.box.y1);
    };
    // Two contrast bars, because the two merge rules carry different risk.
    // Proximity already has evidence — the piece is touching distance from a
    // confirmed product — so it only has to clear a low bar. The mass rule
    // reaches across open background on size alone, so it demands a component
    // that looks strongly like an object; at the low bar, a lit patch of
    // backdrop qualifies and drags the frame back out to the whole photo.
    const solid = (c: Component): boolean => c.depth >= Math.max(4, primary.depth * 0.45);
    const substantial = (c: Component): boolean => c.depth >= Math.max(10, primary.depth * 0.7);
    const mergeByProximity = (): void => {
      let grew = true;
      while (grew) {
        grew = false;
        components.forEach((c, i) => {
          if (merged.has(i) || c.area < 3 || isSliver(c) || !solid(c)) return;
          if (boxGap(box, c.box) <= attachGap) {
            absorb(i, c);
            grew = true;
          }
        });
      }
    };
    mergeByProximity();
    components.forEach((c, i) => {
      if (merged.has(i) || isSliver(c) || !substantial(c)) return;
      if (c.area >= 0.08 * primary.area) absorb(i, c);
    });
    mergeByProximity();

    // Grow through the weak mask so faint attached structure (a pale probe on
    // pale paper) extends the boundary — bounded, so a paper crease cannot
    // walk the box across the whole frame.
    const growCap = Math.round(GROW_DEPTH_FRACTION * diag);
    const depth = new Int16Array(w * h).fill(-1);
    let frontier: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (labels[i] !== undefined && labels[i]! >= 0 && merged.has(labels[i]!)) {
        depth[i] = 0;
        frontier.push(i);
      }
    }
    for (let step = 1; step <= growCap && frontier.length; step++) {
      const next: number[] = [];
      for (const i of frontier) {
        const x = i % w;
        const y = (i / w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (depth[j] !== -1 || !weak[j]) continue;
            depth[j] = step;
            next.push(j);
            box.x0 = Math.min(box.x0, nx);
            box.y0 = Math.min(box.y0, ny);
            box.x1 = Math.max(box.x1, nx + 1);
            box.y1 = Math.max(box.y1, ny + 1);
          }
        }
      }
      frontier = next;
    }

    // Boundary settlement — the rule that outranks tightness.
    //
    // Everything above decides what the product IS from the binary masks, and
    // on a real studio backdrop those masks are wrong in BOTH directions. A
    // curtain fold and the product's own cast shadow clear the colour
    // tolerance, so a component arrives spanning the whole photograph; a pale
    // probe on pale paper barely clears it and is left outside. Settling the
    // box against either mask therefore inherits its errors — which is exactly
    // what put a full-frame "subject" box on every pump photograph of the
    // first shoot, and through it the clipped, wildly-rescaled gallery.
    //
    // So the edges are settled against CONTRAST DEPTH instead. `excess` is how
    // far a pixel stands clear of the nearest background tolerance: ~0 across
    // backdrop that merely drifted past the threshold, large across anything
    // actually sitting on the table. Saturated at SUBJECT_DEPTH and averaged
    // along a row or column, it gives a profile that reads "how much of this
    // line is material" — high across the product, near zero across the scene,
    // and indifferent to whether that material is dark steel or pale PTFE.
    const material = (i: number): number => Math.min(1, excess[i]! / SUBJECT_DEPTH);
    const lineMaterial = (along: "row" | "col", i: number, from: number, to: number): number => {
      let sum = 0;
      if (along === "row") for (let x = from; x < to; x++) sum += material(i * w + x);
      else for (let y = from; y < to; y++) sum += material(y * w + i);
      return sum / Math.max(1, to - from);
    };
    /**
     * One axis' span: the interval outside which lies only a token share of
     * the subject's contrast energy.
     *
     * Thresholding the profile line by line is the obvious method and the
     * wrong one. A white pump housing on a light backdrop has genuinely
     * near-zero contrast across its middle, so any per-line test cuts the
     * product in half there; raising a gap tolerance until it survives makes
     * the rule fire across open background instead. Integrating sidesteps the
     * question — an interior dead zone contributes nothing to either end's
     * running total, so it cannot be mistaken for an edge, while a cable
     * trailing off one side is trimmed for carrying almost no energy.
     *
     * The scene floor is subtracted first, because a lit backdrop carries a
     * low, near-uniform depth of its own that would otherwise accumulate over
     * a long axis and eat the budget before reaching the product. It is taken
     * at the first quartile rather than the median so that a subject filling
     * most of the frame cannot set its own floor.
     */
    const settle = (profile: number[], n: number): [number, number] => {
      const floor = quantile(profile, 0.25);
      const p = profile.map((v) => Math.max(0, v - floor));
      let total = 0;
      for (const v of p) total += v;
      if (total <= 0) return [0, n];
      const budget = total * EDGE_ENERGY_FRACTION;
      let lo = 0;
      for (let acc = 0; lo < n - 1; lo++) {
        acc += p[lo]!;
        if (acc > budget) break;
      }
      let hi = n;
      for (let acc = 0; hi > lo + 1; hi--) {
        acc += p[hi - 1]!;
        if (acc > budget) break;
      }
      return [lo, hi];
    };
    // Alternate axes: each settled span sharpens the other's profile by keeping
    // scenery out of the average. Converges in two or three rounds.
    let rows = new Array<number>(h);
    let cols = new Array<number>(w);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) rows[y] = lineMaterial("row", y, box.x0, box.x1);
      [box.y0, box.y1] = settle(rows, h);
      for (let x = 0; x < w; x++) cols[x] = lineMaterial("col", x, box.y0, box.y1);
      [box.x0, box.x1] = settle(cols, w);
    }

    // Never end on a cut. Trimming by integral is deliberately willing to drop
    // a faint extremity, which is right for a cable trailing out of frame and
    // wrong for the top of a white housing fading into a light backdrop — and
    // a clipped product is the one result this pipeline may never produce. So
    // each edge is walked back OUT while the next line still carries a real
    // share of the material the settled box averages. Background lines sit far
    // below that share, so it cannot run away; and it only ever moves outward,
    // so it can only ever restore product.
    for (let y = 0; y < h; y++) rows[y] = lineMaterial("row", y, box.x0, box.x1);
    for (let x = 0; x < w; x++) cols[x] = lineMaterial("col", x, box.y0, box.y1);
    const rejoin = (profile: number[], lo: number, hi: number, n: number): [number, number] => {
      const inside: number[] = [];
      for (let i = lo; i < hi; i++) inside.push(profile[i]!);
      const floor = quantile(profile, 0.25);
      const bar = floor + Math.max(REJOIN_FLOOR, REJOIN_FRACTION * Math.max(0, median(inside) - floor));
      const reach = Math.round(REJOIN_REACH * n);
      // The same short gap the proximity merge already forgives: a probe held
      // clear of the body is attached to it, a stray object across the table
      // is not, and the distance that separates the two cases is one constant.
      const skip = Math.max(1, Math.round(attachGap));
      let a = lo;
      for (let i = lo - 1, idle = 0; i >= 0 && lo - i <= reach; i--) {
        if (profile[i]! >= bar) {
          a = i;
          idle = 0;
        } else if (++idle > skip) break;
      }
      let b = hi;
      for (let i = hi, idle = 0; i < n && i - hi < reach; i++) {
        if (profile[i]! >= bar) {
          b = i + 1;
          idle = 0;
        } else if (++idle > skip) break;
      }
      return [a, b];
    };
    [box.y0, box.y1] = rejoin(rows, box.y0, box.y1, h);
    [box.x0, box.x1] = rejoin(cols, box.x0, box.x1, w);

    // Focal point: the subject's centre of contrast mass inside the settled
    // box. Weighting by depth rather than counting mask pixels keeps a broad
    // patch of near-threshold backdrop from dragging the point off the product.
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = box.y0; y < box.y1; y++) {
      for (let x = box.x0; x < box.x1; x++) {
        const e = excess[y * w + x]!;
        if (e <= 0) continue;
        sx += (x + 0.5) * e;
        sy += (y + 0.5) * e;
        n += e;
      }
    }

    const coverage = ((box.x1 - box.x0) * (box.y1 - box.y0)) / (w * h);
    if (coverage < 0.02 || strongMass / (w * h) < 0.006) {
      return { ...whole(fullW, fullH, tilt, dominant), coverage };
    }

    const edge = Math.max(2, Math.round(0.015 * Math.min(w, h)));
    const sx0 = fullW / w;
    const sy0 = fullH / h;
    return {
      width: fullW,
      height: fullH,
      tiltDeg: tilt,
      background: dominant,
      box: {
        x0: Math.max(0, Math.floor(box.x0 * sx0)),
        y0: Math.max(0, Math.floor(box.y0 * sy0)),
        x1: Math.min(fullW, Math.ceil(box.x1 * sx0)),
        y1: Math.min(fullH, Math.ceil(box.y1 * sy0)),
      },
      touches: {
        left: box.x0 <= edge,
        top: box.y0 <= edge,
        right: box.x1 >= w - edge,
        bottom: box.y1 >= h - edge,
      },
      focalX: clamp(((sx / Math.max(1, n)) / w) * 100, 0, 100),
      focalY: clamp(((sy / Math.max(1, n)) / h) * 100, 0, 100),
      coverage,
      confident: coverage <= 0.97,
    };
  } catch {
    return whole(fullW, fullH);
  }
}

export type PlanInput = {
  width: number;
  height: number;
  box: Box;
  confident: boolean;
  tiltDeg?: number;
  background?: RGB;
  touches?: Sides<boolean>;
};

/**
 * Plan the 4:3 display window for an image given its subject analysis and
 * focal point. Pure geometry — no I/O — so the interesting cases live in
 * unit tests.
 */
export function planDisplayCrop(input: PlanInput, focal?: { x: number; y: number }): DisplayPlan {
  const imgW = input.width;
  const imgH = input.height;
  const rotate = input.tiltDeg ?? 0;
  const background = input.background ?? { r: 255, g: 255, b: 255 };

  type Window = { left: number; top: number; width: number; height: number };

  /**
   * Lay a 4:3 window over the photograph and turn it into a plan. Whatever of
   * the window falls outside the photograph stays transparent — the renderer
   * invents nothing, so the only way a window reaches past the edge is the
   * whole-photograph fallback, where the bars are deliberate.
   */
  const finish = (win: Window, mode: DisplayPlan["mode"], subject?: Box): DisplayPlan => {
    const cropLeft = clamp(Math.round(win.left), 0, imgW);
    const cropTop = clamp(Math.round(win.top), 0, imgH);
    const crop = {
      left: cropLeft,
      top: cropTop,
      width: Math.max(1, clamp(Math.round(win.left + win.width), 0, imgW) - cropLeft),
      height: Math.max(1, clamp(Math.round(win.top + win.height), 0, imgH) - cropTop),
    };
    const s = Math.min(DISPLAY_SIZE.width / win.width, DISPLAY_SIZE.height / win.height, MAX_SCALE);
    const scaled = {
      width: clamp(Math.round(crop.width * s), 1, DISPLAY_SIZE.width),
      height: clamp(Math.round(crop.height * s), 1, DISPLAY_SIZE.height),
    };
    // Where that piece of photograph lands: its offset inside the window,
    // scaled — plus the window's own centring when the upscale cap keeps the
    // window from filling the canvas.
    const offX = (DISPLAY_SIZE.width - win.width * s) / 2;
    const offY = (DISPLAY_SIZE.height - win.height * s) / 2;
    const place = {
      left: Math.round(
        clamp(offX + (crop.left - win.left) * s, 0, DISPLAY_SIZE.width - scaled.width)
      ),
      top: Math.round(
        clamp(offY + (crop.top - win.top) * s, 0, DISPLAY_SIZE.height - scaled.height)
      ),
    };
    return {
      rotate,
      background,
      crop,
      scaled,
      out: { ...DISPLAY_SIZE },
      place,
      subject,
      mode,
    };
  };

  const wholeImage = (): DisplayPlan => {
    const windowW = Math.max(imgW, imgH * RATIO);
    const windowH = windowW / RATIO;
    return finish(
      { left: (imgW - windowW) / 2, top: (imgH - windowH) / 2, width: windowW, height: windowH },
      "whole-image"
    );
  };
  if (!input.confident || imgW <= 0 || imgH <= 0) return wholeImage();

  const subject = input.box;
  const bx0 = clamp(subject.x0, 0, imgW);
  const by0 = clamp(subject.y0, 0, imgH);
  const bx1 = clamp(subject.x1, 0, imgW);
  const by1 = clamp(subject.y1, 0, imgH);
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  if (bw <= 0 || bh <= 0) return wholeImage();

  // The catalogue standard: whichever of the subject's dimensions binds first
  // occupies SUBJECT_OCCUPANCY of the canvas along that axis. A squat pump and
  // a tall electrode are therefore printed at the same visual weight inside the
  // same clear margin, which is the property that makes two hundred photographs
  // from different shoots read as one catalogue rather than as a folder.
  //
  // The margin is granted on every side, including sides where the subject
  // already runs off the photograph: the renderer extends the background, so
  // there is nothing to gain by leaving a product jammed against the frame
  // edge — which is what the old hair margin did. Floored so the upscale cap
  // can't leave dead space around a small subject when the photo has real
  // background to offer instead.
  let windowW = Math.max(bw, bh * RATIO) / SUBJECT_OCCUPANCY;
  const floorW = Math.min(DISPLAY_SIZE.width / MAX_SCALE, Math.max(imgW, imgH * RATIO));
  windowW = Math.max(windowW, floorW);
  const windowH = windowW / RATIO;

  /**
   * Where to centre that window. The subject box's middle, pulled toward the
   * focal point — a cell trailing a metre of tubing has a box centre out in
   * the tubing, and centring on that alone parks the body off to one side.
   * Bounded twice: never past the quarter marks of the subject (the pull is a
   * bias, not a relocation), and never so far that it spends more than half
   * the margin the standard just bought — "the window still contains the
   * subject" is not enough of a bound, because it permits a product leaning
   * flat against one edge with all its breathing room on the other.
   */
  const bias = (c: number, m: number, lo: number, hi: number, half: number): number => {
    const v = c + (m - c) * MASS_PULL;
    const span = hi - lo;
    const keep = Math.max(0, (half * 2 - span) / 4); // half the centred margin
    return clamp(
      v,
      Math.max(lo + span * 0.25, hi - half + keep),
      Math.min(lo + span * 0.75, lo + half - keep)
    );
  };
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  const windowAt = (width: number): Window => {
    const height = width / RATIO;
    const x = focal ? bias(cx, (focal.x / 100) * imgW, bx0, bx1, width / 2) : cx;
    const y = focal ? bias(cy, (focal.y / 100) * imgH, by0, by1, height / 2) : cy;
    return { left: x - width / 2, top: y - height / 2, width, height };
  };
  // Nothing is ever invented. Every pixel of the crop is a piece of the
  // photograph, so the window may only be as large as the photograph can
  // supply — the largest 4:3 rectangle that fits inside it.
  const supply = Math.min(imgW, imgH * RATIO);
  const fitW = Math.min(windowW, supply);
  const fitH = fitW / RATIO;

  if (fitW >= bw && fitH >= bh) {
    // It holds the product: sit it on the subject, then slide it back inside
    // the frame. Sliding can push the product off centre by a little, and that
    // is the price of never fabricating background; it can never cut the
    // product, because the window is larger than the subject and moves toward
    // it, not away.
    const ideal = windowAt(fitW);
    return finish(
      {
        left: clamp(ideal.left, 0, imgW - fitW),
        top: clamp(ideal.top, 0, imgH - fitH),
        width: fitW,
        height: fitH,
      },
      "subject",
      { x0: bx0, y0: by0, x1: bx1, y1: by1 }
    );
  }

  // No 4:3 window this photograph can supply holds the whole product — a tall
  // product shot in portrait, where the widest 4:3 rectangle that fits is still
  // shorter than the product. The frame is then taken from the product itself
  // rather than from the ratio: crop to the product plus the standard margin,
  // grown toward 4:3 as far as the photograph allows, and let the canvas stay
  // clear beside it.
  //
  // Showing the WHOLE photograph here is the obvious fallback and the wrong
  // one. It keeps every inch of empty backdrop above and below the product, so
  // the fit is bound by that emptiness and the product lands at a third of the
  // frame while a landscape shot of the same pump fills it — the two sit side
  // by side in the grid looking like different products. Cropping the margin
  // away costs nothing (it is background) and puts the product back at
  // SUBJECT_OCCUPANCY of the binding axis, which is the whole point of having
  // a standard.
  //
  // The margin is taken on the product's own proportions and NOT grown out
  // toward 4:3. Growing it was the obvious way to avoid a narrow frame, and it
  // reached to the photograph's full width — which on these shoots is past the
  // edge of the sweep, so the frame filled with the grey wall and the board's
  // edge, in bands down both sides. A narrower frame of clean backdrop looks
  // like a catalogue; a wide one full of the room does not.
  const rw = clamp(bw / SUBJECT_OCCUPANCY, bw, imgW);
  const rh = clamp(bh / SUBJECT_OCCUPANCY, bh, imgH);
  return finish(
    {
      left: clamp((bx0 + bx1) / 2 - rw / 2, 0, imgW - rw),
      top: clamp((by0 + by1) / 2 - rh / 2, 0, imgH - rh),
      width: rw,
      height: rh,
    },
    "subject",
    { x0: bx0, y0: by0, x1: bx1, y1: by1 }
  );
}

/** Decode the corrected (EXIF + tilt) image as a raw RGBA raster. */
async function decodeCorrected(input: Buffer, plan: DisplayPlan): Promise<Raster & { channels: 4 }> {
  const exif = await sharp(input).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let data = exif.data;
  let width = exif.info.width;
  let height = exif.info.height;
  if (plan.rotate !== 0) {
    const turned = await sharp(data, { raw: { width, height, channels: 4 } })
      .rotate(plan.rotate, { background: { ...plan.background, alpha: 1 } })
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = turned.data;
    width = turned.info.width;
    height = turned.info.height;
  }
  return { data, width, height, channels: 4 };
}

/**
 * Render the display derivative: straighten, extract the planned window, scale
 * it to the canvas and place it.
 *
 * Nothing is synthesised. An earlier version continued the backdrop into
 * whatever the photograph could not fill — reflected, smoothed, washed toward
 * the scene colour — and every version of that left something visible on the
 * flank: a smear, a duplicated board edge, a tonal band. Where the photograph
 * runs out the canvas is simply left clear, which the shop renders as the card
 * background, and the framing decisions in planDisplayCrop are what keep that
 * space looking deliberate rather than accidental.
 */
export async function renderDisplay(input: Buffer, plan: DisplayPlan): Promise<Buffer> {
  const img = await decodeCorrected(input, plan);
  // Rounding in the plan can push the window a pixel past the edge — clamp.
  const width = Math.min(plan.crop.width, img.width);
  const height = Math.min(plan.crop.height, img.height);
  const left = clamp(plan.crop.left, 0, img.width - width);
  const top = clamp(plan.crop.top, 0, img.height - height);
  const region = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
    .extract({ left, top, width, height })
    .resize(plan.scaled.width, plan.scaled.height, { fit: "fill" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: plan.out.width,
      height: plan.out.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: region, left: plan.place.left, top: plan.place.top }])
    .webp({ quality: 88 })
    .toBuffer();
}
