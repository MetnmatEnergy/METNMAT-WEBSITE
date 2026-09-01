/**
 * Subject-aware composition analysis for product photographs.
 *
 * Product photos are objects on a broadly uniform studio background (white
 * table, grey curtain). That makes classical analysis reliable without any ML
 * dependency: estimate the background colour from the border ring of a small
 * thumbnail, mark pixels that deviate from it, and take the bounding box of the
 * marked region. The box centroid doubles as the automatic focal point, stored
 * in Payload's own focalX/focalY so staff can drag-correct it in the admin.
 *
 * From the subject box this module plans the DISPLAY crop: the smallest 4:3
 * window that fully contains the subject plus breathing room, biased toward
 * the focal point and clamped to the photo. Whatever the window cannot cover
 * (a portrait too narrow for 4:3) is made up with transparent padding. The
 * subject is therefore never cut and never distorted — only background is
 * traded away.
 *
 * Pure geometry + raw-pixel math, unit-tested from test/ at the repo root.
 */
import sharp from "sharp";

export type Box = { x0: number; y0: number; x1: number; y1: number };

export type SubjectAnalysis = {
  /** Full-resolution image dimensions after EXIF orientation. */
  width: number;
  height: number;
  /** Subject bounding box in full-resolution pixel coordinates. */
  box: Box;
  /** Subject centroid as percentages (Payload focalX/focalY convention). */
  focalX: number;
  focalY: number;
  /** Fraction of the image area the subject box covers (0..1). */
  coverage: number;
  /** False when detection was degenerate and callers should fall back. */
  confident: boolean;
};

export type DisplayPlan = {
  /** Region of the original to extract (full-resolution pixels). */
  crop: { left: number; top: number; width: number; height: number };
  /** The extracted region's target size on the output canvas. */
  scaled: { width: number; height: number };
  /** Fixed output canvas (always 4:3). */
  out: { width: number; height: number };
  /** Why this plan was chosen — "subject" or a fallback reason. */
  mode: "subject" | "whole-image";
};

export const DISPLAY_SIZE = { width: 1600, height: 1200 } as const;
const RATIO = DISPLAY_SIZE.width / DISPLAY_SIZE.height; // 4:3
/** Upscale cap for the extracted region — past ~2× photos turn to mush. */
const MAX_SCALE = 2;
/** Breathing room around the subject, as a fraction of its larger dimension. */
const MARGIN_FRACTION = 0.06;
/** Analysis thumbnail bound — enough signal, trivial cost. */
const ANALYSIS_SIZE = 96;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Detect the subject of a photograph. Returns `confident: false` (with a
 * whole-image box) when the scene doesn't behave like an object on a uniform
 * background — busy scenes, full-bleed subjects, unreadable files.
 */
export async function analyzeSubject(input: Buffer): Promise<SubjectAnalysis> {
  const whole = (w: number, h: number): SubjectAnalysis => ({
    width: w,
    height: h,
    box: { x0: 0, y0: 0, x1: w, y1: h },
    focalX: 50,
    focalY: 50,
    coverage: 1,
    confident: false,
  });

  let fullW = 0;
  let fullH = 0;
  try {
    const src = sharp(input).rotate();
    const meta = await src.metadata();
    const turned = (meta.orientation ?? 1) >= 5;
    fullW = (turned ? meta.height : meta.width) ?? 0;
    fullH = (turned ? meta.width : meta.height) ?? 0;
    if (!fullW || !fullH) return whole(0, 0);

    const { data, info } = await src
      .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "inside" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    if (w < 8 || h < 8) return whole(fullW, fullH);

    const px = (x: number, y: number): [number, number, number] => {
      const o = (y * w + x) * 3;
      return [data[o]!, data[o + 1]!, data[o + 2]!];
    };

    // Background estimate: median channel values over the 1px border ring.
    const ring: [number, number, number][] = [];
    for (let x = 0; x < w; x++) ring.push(px(x, 0), px(x, h - 1));
    for (let y = 1; y < h - 1; y++) ring.push(px(0, y), px(w - 1, y));
    const median = (values: number[]): number => {
      const s = [...values].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)]!;
    };
    const bg = [median(ring.map((p) => p[0])), median(ring.map((p) => p[1])), median(ring.map((p) => p[2]))] as const;

    const dist = (p: [number, number, number]): number =>
      Math.sqrt((p[0] - bg[0]) ** 2 + (p[1] - bg[1]) ** 2 + (p[2] - bg[2]) ** 2);

    // Threshold adapts to border noise (shadows, curtain folds), with a floor.
    const ringSpread = ring.map(dist);
    const mean = ringSpread.reduce((a, b) => a + b, 0) / ringSpread.length;
    const variance = ringSpread.reduce((a, b) => a + (b - mean) ** 2, 0) / ringSpread.length;
    const threshold = Math.max(30, mean + 2.5 * Math.sqrt(variance));

    // Column/row profiles of foreground counts; requiring ≥2 hits per line
    // ignores isolated speckle without a full morphological pass.
    const colHits = new Array<number>(w).fill(0);
    const rowHits = new Array<number>(h).fill(0);
    let total = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (dist(px(x, y)) > threshold) {
          colHits[x]!++;
          rowHits[y]!++;
          total++;
        }
      }
    }
    const first = (hits: number[]): number => hits.findIndex((c) => c >= 2);
    const last = (hits: number[]): number => hits.length - 1 - [...hits].reverse().findIndex((c) => c >= 2);
    const cx0 = first(colHits);
    const cy0 = first(rowHits);
    if (cx0 < 0 || cy0 < 0) return whole(fullW, fullH);
    const cx1 = last(colHits) + 1;
    const cy1 = last(rowHits) + 1;

    const coverage = ((cx1 - cx0) * (cy1 - cy0)) / (w * h);
    // Nearly nothing or nearly everything detected → the scene is not "object
    // on background"; report low confidence so the caller keeps the whole frame.
    if (coverage < 0.03 || coverage > 0.95 || total / (w * h) < 0.01) {
      return { ...whole(fullW, fullH), coverage };
    }

    // Weighted centroid of foreground for the focal point.
    let sx = 0;
    let sy = 0;
    for (let x = 0; x < w; x++) sx += colHits[x]! * (x + 0.5);
    for (let y = 0; y < h; y++) sy += rowHits[y]! * (y + 0.5);
    const scaleX = fullW / w;
    const scaleY = fullH / h;

    return {
      width: fullW,
      height: fullH,
      box: {
        x0: Math.floor(cx0 * scaleX),
        y0: Math.floor(cy0 * scaleY),
        x1: Math.ceil(cx1 * scaleX),
        y1: Math.ceil(cy1 * scaleY),
      },
      focalX: clamp(((sx / total) * scaleX / fullW) * 100, 0, 100),
      focalY: clamp(((sy / total) * scaleY / fullH) * 100, 0, 100),
      coverage,
      confident: true,
    };
  } catch {
    return whole(fullW, fullH);
  }
}

/**
 * Plan the 4:3 display crop for an image given its subject box and focal
 * point. Pure geometry — no I/O — so the interesting cases live in unit tests.
 */
export function planDisplayCrop(
  imgW: number,
  imgH: number,
  subject: Box,
  focal?: { x: number; y: number },
  confident = true
): DisplayPlan {
  const wholeImage = (): DisplayPlan => {
    const canvasW = Math.max(imgW, imgH * RATIO);
    const s = Math.min(DISPLAY_SIZE.width / canvasW, MAX_SCALE);
    return {
      crop: { left: 0, top: 0, width: imgW, height: imgH },
      scaled: { width: Math.round(imgW * s), height: Math.round(imgH * s) },
      out: { ...DISPLAY_SIZE },
      mode: "whole-image",
    };
  };
  if (!confident || imgW <= 0 || imgH <= 0) return wholeImage();

  // Breathing room around the subject, clamped to the photo.
  const margin = MARGIN_FRACTION * Math.max(subject.x1 - subject.x0, subject.y1 - subject.y0);
  const bx0 = clamp(subject.x0 - margin, 0, imgW);
  const by0 = clamp(subject.y0 - margin, 0, imgH);
  const bx1 = clamp(subject.x1 + margin, 0, imgW);
  const by1 = clamp(subject.y1 + margin, 0, imgH);
  const bw = bx1 - bx0;
  const bh = by1 - by0;
  if (bw <= 0 || bh <= 0) return wholeImage();

  // Smallest 4:3 window containing the padded subject.
  const windowW = Math.max(bw, bh * RATIO);
  const windowH = windowW / RATIO;

  // Crop what the photo can supply of that window; the remainder is padding.
  const cropW = Math.min(windowW, imgW);
  const cropH = Math.min(windowH, imgH);

  // Position the crop: keep the subject inside, lean toward the focal point.
  const fx = ((focal?.x ?? 50) / 100) * imgW;
  const fy = ((focal?.y ?? 50) / 100) * imgH;
  const position = (size: number, lo: number, hi: number, imgMax: number, f: number): number => {
    // Legal range that still contains the subject span [lo, hi]…
    let min = Math.max(0, hi - size);
    let max = Math.min(imgMax - size, lo);
    if (min > max) {
      // Subject span wider than the crop (possible only when the window was
      // clamped): centre the crop on the span instead.
      const c = (lo + hi) / 2 - size / 2;
      min = max = clamp(c, 0, imgMax - size);
    }
    return clamp(f - size / 2, min, max);
  };
  const left = position(cropW, bx0, bx1, imgW, fx);
  const top = position(cropH, by0, by1, imgH, fy);

  // Scale so the padded 4:3 window fits the fixed output, upscale capped.
  const s = Math.min(DISPLAY_SIZE.width / windowW, DISPLAY_SIZE.height / windowH, MAX_SCALE);

  return {
    crop: {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(cropW),
      height: Math.round(cropH),
    },
    scaled: { width: Math.max(1, Math.round(cropW * s)), height: Math.max(1, Math.round(cropH * s)) },
    out: { ...DISPLAY_SIZE },
    mode: "subject",
  };
}

/** Render the display derivative: extract → scale → centre on transparent 4:3. */
export async function renderDisplay(input: Buffer, plan: DisplayPlan): Promise<Buffer> {
  const rotated = sharp(input).rotate();
  const meta = await rotated.metadata();
  const turned = (meta.orientation ?? 1) >= 5;
  const imgW = (turned ? meta.height : meta.width) ?? plan.crop.width;
  const imgH = (turned ? meta.width : meta.height) ?? plan.crop.height;
  // Rounding in the plan can push the window a pixel past the edge — clamp.
  const width = Math.min(plan.crop.width, imgW);
  const height = Math.min(plan.crop.height, imgH);
  const left = clamp(plan.crop.left, 0, imgW - width);
  const top = clamp(plan.crop.top, 0, imgH - height);
  const region = await rotated
    .extract({ left, top, width, height })
    .resize(plan.scaled.width, plan.scaled.height, { fit: "inside" })
    .toBuffer();
  return sharp({
    create: {
      width: plan.out.width,
      height: plan.out.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: region, gravity: "centre" }])
    .webp({ quality: 88 })
    .toBuffer();
}
