import { describe, it, expect } from "vitest";
import sharp from "../apps/dashboard/node_modules/sharp/lib/index.js";
import {
  analyzeSubject,
  planDisplayCrop,
  renderDisplay,
  DISPLAY_SIZE,
  type Box,
  type PlanInput,
} from "../apps/dashboard/src/lib/product-image-analysis";

/**
 * The display pipeline's promises, as invariants:
 *  - the subject is never cut (the crop contains the subject box),
 *  - nothing is ever distorted (crop and its scaled size share one aspect),
 *  - upscaling is capped (×2), the output canvas is always exactly 4:3,
 *  - the artwork lands fully on the canvas, subject optically centred,
 *  - slight tilt is corrected, deliberate angles are left alone,
 *  - split backgrounds are understood, far-away clutter is excluded,
 *  - degenerate detection falls back to the whole image instead of guessing.
 */

const aspect = (w: number, h: number): number => w / h;

const plan4 = (
  imgW: number,
  imgH: number,
  box: Box,
  focal?: { x: number; y: number },
  extra?: Partial<PlanInput>
) => planDisplayCrop({ width: imgW, height: imgH, box, confident: true, ...extra }, focal);

const expectPlanInvariants = (
  plan: ReturnType<typeof planDisplayCrop>,
  imgW: number,
  imgH: number,
  subject?: Box
) => {
  // Crop stays inside the image.
  expect(plan.crop.left).toBeGreaterThanOrEqual(0);
  expect(plan.crop.top).toBeGreaterThanOrEqual(0);
  expect(plan.crop.left + plan.crop.width).toBeLessThanOrEqual(imgW + 1);
  expect(plan.crop.top + plan.crop.height).toBeLessThanOrEqual(imgH + 1);
  // Never distorted: scaled aspect equals crop aspect (within rounding).
  expect(aspect(plan.scaled.width, plan.scaled.height)).toBeCloseTo(
    aspect(plan.crop.width, plan.crop.height),
    1
  );
  // Upscale cap ×2 (+ rounding slack).
  expect(plan.scaled.width).toBeLessThanOrEqual(plan.crop.width * 2 + 2);
  // Output canvas is the fixed 4:3 frame and the artwork sits fully on it.
  expect(plan.out).toEqual({ width: DISPLAY_SIZE.width, height: DISPLAY_SIZE.height });
  expect(plan.place.left).toBeGreaterThanOrEqual(0);
  expect(plan.place.top).toBeGreaterThanOrEqual(0);
  expect(plan.place.left + plan.scaled.width).toBeLessThanOrEqual(DISPLAY_SIZE.width);
  expect(plan.place.top + plan.scaled.height).toBeLessThanOrEqual(DISPLAY_SIZE.height);
  // The subject survives whenever the crop is big enough to hold it.
  if (subject) {
    const sw = subject.x1 - subject.x0;
    const sh = subject.y1 - subject.y0;
    if (plan.crop.width >= sw && plan.crop.height >= sh) {
      expect(plan.crop.left).toBeLessThanOrEqual(subject.x0 + 1);
      expect(plan.crop.top).toBeLessThanOrEqual(subject.y0 + 1);
      expect(plan.crop.left + plan.crop.width).toBeGreaterThanOrEqual(subject.x1 - 1);
      expect(plan.crop.top + plan.crop.height).toBeGreaterThanOrEqual(subject.y1 - 1);
    }
  }
};

describe("planDisplayCrop", () => {
  it("tightens a landscape photo to its subject in a 4:3 window", () => {
    const subject: Box = { x0: 400, y0: 300, x1: 2000, y1: 1400 };
    const plan = plan4(2400, 1800, subject, { x: 50, y: 47 });
    expect(plan.mode).toBe("subject");
    expectPlanInvariants(plan, 2400, 1800, subject);
    // Substantially tighter than the whole frame.
    expect(plan.crop.width).toBeLessThan(2400);
  });

  it("gives a portrait photo's subject the full 4:3 window height", () => {
    // 960×1280 portrait, compact centred subject — the old disease case.
    const subject: Box = { x0: 260, y0: 380, x1: 700, y1: 920 };
    const plan = plan4(960, 1280, subject, { x: 50, y: 50 });
    expect(plan.mode).toBe("subject");
    expectPlanInvariants(plan, 960, 1280, subject);
    // The 4:3 window around this subject is wider than tall and roughly square
    // to the subject — nothing like the 3:4 whole frame.
    expect(aspect(plan.crop.width, plan.crop.height)).toBeGreaterThan(1);
  });

  it("pads instead of cutting when the subject spans the full portrait width", () => {
    const subject: Box = { x0: 10, y0: 100, x1: 950, y1: 1240 };
    const plan = plan4(960, 1280, subject, { x: 50, y: 50 });
    expectPlanInvariants(plan, 960, 1280, subject);
    // Window wants 4:3 of the tall span → wider than the photo → crop clamps to
    // full width and the remainder becomes padding, never a cut.
    expect(plan.crop.width).toBe(960);
    // The padding splits evenly: the subject is centred, not shoved to a side.
    const padLeft = plan.place.left;
    const padRight = DISPLAY_SIZE.width - plan.place.left - plan.scaled.width;
    expect(Math.abs(padLeft - padRight)).toBeLessThanOrEqual(12);
  });

  it("centres the subject on the canvas when the photo can supply the window", () => {
    const subject: Box = { x0: 200, y0: 300, x1: 760, y1: 900 };
    const plan = plan4(960, 1280, subject, { x: 50, y: 47 });
    expectPlanInvariants(plan, 960, 1280, subject);
    const cx = (subject.x0 + subject.x1) / 2;
    const s = plan.scaled.width / plan.crop.width;
    const onCanvas = plan.place.left + (cx - plan.crop.left) * s;
    expect(Math.abs(onCanvas - DISPLAY_SIZE.width / 2)).toBeLessThanOrEqual(24);
  });

  it("grows the window with real background instead of leaving cap dead space", () => {
    // Tiny subject: the ×2 cap alone would render it small on the canvas.
    const subject: Box = { x0: 500, y0: 400, x1: 700, y1: 550 };
    const plan = plan4(1280, 960, subject, { x: 47, y: 49 });
    expectPlanInvariants(plan, 1280, 960, subject);
    // Window floored at out/MAX_SCALE → the canvas is filled edge to edge.
    expect(plan.crop.width).toBeGreaterThanOrEqual(DISPLAY_SIZE.width / 2 - 1);
    expect(plan.scaled.width).toBeGreaterThanOrEqual(DISPLAY_SIZE.width - 2);
  });

  it("keeps only a hair margin on sides the subject already runs off", () => {
    const subject: Box = { x0: 100, y0: 0, x1: 860, y1: 1280 }; // full height
    const touching = plan4(960, 1280, subject, { x: 50, y: 50 }, {
      touches: { left: false, right: false, top: true, bottom: true },
    });
    expectPlanInvariants(touching, 960, 1280, subject);
    // Window height stays close to the subject height — no fat margin added
    // beyond edges the photograph itself already cut.
    expect(touching.crop.height).toBe(1280);
  });

  it("leans toward the focal point within the legal range", () => {
    const subject: Box = { x0: 900, y0: 700, x1: 1500, y1: 1100 };
    const left = plan4(2400, 1800, subject, { x: 10, y: 50 });
    const right = plan4(2400, 1800, subject, { x: 90, y: 50 });
    expectPlanInvariants(left, 2400, 1800, subject);
    expectPlanInvariants(right, 2400, 1800, subject);
    expect(left.crop.left).toBeLessThanOrEqual(right.crop.left);
  });

  it("falls back to the whole image when detection was not confident", () => {
    const plan = planDisplayCrop({
      width: 960,
      height: 1280,
      box: { x0: 0, y0: 0, x1: 960, y1: 1280 },
      confident: false,
    });
    expect(plan.mode).toBe("whole-image");
    expect(plan.crop).toEqual({ left: 0, top: 0, width: 960, height: 1280 });
    expectPlanInvariants(plan, 960, 1280);
  });
});

/** Synthetic photo helpers. */
type Rect = { left: number; top: number; width: number; height: number; color?: { r: number; g: number; b: number } };
const photo = async (
  w: number,
  h: number,
  rects: Rect[] = [],
  opts?: { split?: boolean; rotate?: number }
) => {
  const bg = opts?.split ? { r: 130, g: 128, b: 126 } : { r: 245, g: 244, b: 240 };
  let base = sharp({ create: { width: w, height: h, channels: 3, background: bg } });
  const layers: { input: Buffer; left: number; top: number }[] = [];
  if (opts?.split) {
    // Grey "curtain" above, white "table" below — the split-background scene.
    layers.push({
      input: await sharp({
        create: { width: w, height: Math.floor(h / 2), channels: 3, background: { r: 242, g: 241, b: 238 } },
      })
        .png()
        .toBuffer(),
      left: 0,
      top: Math.floor(h / 2),
    });
  }
  for (const r of rects) {
    layers.push({
      input: await sharp({
        create: {
          width: r.width,
          height: r.height,
          channels: 3,
          background: r.color ?? { r: 60, g: 62, b: 70 },
        },
      })
        .png()
        .toBuffer(),
      left: r.left,
      top: r.top,
    });
  }
  let buf = await base.composite(layers).jpeg({ quality: 92 }).toBuffer();
  if (opts?.rotate) {
    buf = await sharp(buf)
      .rotate(opts.rotate, { background: bg })
      .jpeg({ quality: 92 })
      .toBuffer();
  }
  return buf;
};

describe("analyzeSubject", () => {
  it("finds a dark object on a light background within tolerance", async () => {
    const rect = { left: 300, top: 500, width: 360, height: 420 };
    const analysis = await analyzeSubject(await photo(960, 1280, [rect]));
    expect(analysis.confident).toBe(true);
    expect(analysis.width).toBe(960);
    expect(analysis.height).toBe(1280);
    expect(analysis.tiltDeg).toBe(0);
    const tolX = 960 * 0.06;
    const tolY = 1280 * 0.06;
    expect(Math.abs(analysis.box.x0 - rect.left)).toBeLessThanOrEqual(tolX);
    expect(Math.abs(analysis.box.y0 - rect.top)).toBeLessThanOrEqual(tolY);
    expect(Math.abs(analysis.box.x1 - (rect.left + rect.width))).toBeLessThanOrEqual(tolX);
    expect(Math.abs(analysis.box.y1 - (rect.top + rect.height))).toBeLessThanOrEqual(tolY);
    // Focal lands inside the object.
    expect(analysis.focalX).toBeGreaterThan((rect.left / 960) * 100);
    expect(analysis.focalX).toBeLessThan(((rect.left + rect.width) / 960) * 100);
  });

  it("understands a split background (curtain above, table below)", async () => {
    const rect = { left: 260, top: 380, width: 400, height: 500 };
    const analysis = await analyzeSubject(await photo(960, 1280, [rect], { split: true }));
    expect(analysis.confident).toBe(true);
    const tol = 960 * 0.07;
    expect(Math.abs(analysis.box.x0 - rect.left)).toBeLessThanOrEqual(tol);
    expect(Math.abs(analysis.box.x1 - (rect.left + rect.width))).toBeLessThanOrEqual(tol);
    // Neither the curtain nor the table registered as subject.
    expect(analysis.coverage).toBeLessThan(0.5);
  });

  it("excludes far-away clutter from the subject box", async () => {
    const main = { left: 440, top: 300, width: 400, height: 360 };
    const clutter = { left: 1150, top: 840, width: 70, height: 70 };
    const analysis = await analyzeSubject(await photo(1280, 960, [main, clutter]));
    expect(analysis.confident).toBe(true);
    // The stray corner object is not part of the product.
    expect(analysis.box.x1).toBeLessThan(1100);
    expect(analysis.box.y1).toBeLessThan(800);
  });

  it("merges attached parts sitting close to the product", async () => {
    const main = { left: 440, top: 300, width: 400, height: 360 };
    const probe = { left: 320, top: 400, width: 90, height: 40 }; // 30px gap
    const analysis = await analyzeSubject(await photo(1280, 960, [main, probe]));
    expect(analysis.confident).toBe(true);
    expect(analysis.box.x0).toBeLessThanOrEqual(probe.left + 20);
  });

  it("corrects a slight tilt (and the sign is right)", async () => {
    // A 6°-tilted rectangle: with the right correction the detected box is the
    // rectangle; with the wrong sign the tilt doubles and the box inflates.
    const rect = { left: 400, top: 300, width: 400, height: 300 };
    const analysis = await analyzeSubject(await photo(1200, 900, [rect], { rotate: 6 }));
    expect(Math.abs(analysis.tiltDeg)).toBeGreaterThan(3);
    expect(Math.abs(analysis.tiltDeg)).toBeLessThan(9);
    expect(analysis.confident).toBe(true);
    const bw = analysis.box.x1 - analysis.box.x0;
    const bh = analysis.box.y1 - analysis.box.y0;
    // Straightened: close to 400×300. Wrong sign would give ≥ 450×370.
    expect(bw).toBeLessThan(400 * 1.12);
    expect(bh).toBeLessThan(300 * 1.15);
  });

  it("leaves a deliberate three-quarter angle alone", async () => {
    const rect = { left: 400, top: 300, width: 400, height: 300 };
    const analysis = await analyzeSubject(await photo(1200, 900, [rect], { rotate: 30 }));
    expect(analysis.tiltDeg).toBe(0);
  });

  it("reports low confidence on a featureless image", async () => {
    const analysis = await analyzeSubject(await photo(800, 600));
    expect(analysis.confident).toBe(false);
    expect(analysis.box).toEqual({ x0: 0, y0: 0, x1: 800, y1: 600 });
  });

  /**
   * The failure this guards against reached the live gallery: a cream PEEK
   * cell photographed against a shaded wall above a white table lost its top
   * block and its electrode pin, because the wall's own light-to-dark ramp
   * inflated the background tolerance until the product fell inside it. The
   * scene below reproduces that geometry — graded backdrop, pale body, thin
   * protrusion — and the box must reach the top of the pin.
   */
  it("keeps a pale product and its thin protrusion on a graded backdrop", async () => {
    const W = 960;
    const H = 1280;
    // The real scene: a shaded wall over the top ~28%, a white table below,
    // each with its own light-to-dark ramp across the frame. One loose
    // background cluster over that is what used to swallow the product.
    const HORIZON = Math.round(H * 0.28);
    const ramp = Buffer.alloc(W * H * 3);
    for (let y = 0; y < H; y++) {
      const onWall = y < HORIZON;
      const t = onWall ? y / HORIZON : (y - HORIZON) / (H - HORIZON);
      const v = Math.round(onWall ? 150 + 38 * t : 228 + 16 * t);
      for (let x = 0; x < W; x++) {
        const o = (y * W + x) * 3;
        const shade = Math.round((8 * x) / (W - 1)); // cross-frame falloff too
        ramp[o] = v + shade;
        ramp[o + 1] = v + shade;
        ramp[o + 2] = v + shade - 3;
      }
    }
    const cream = { r: 226, g: 221, b: 200 };
    const body = { left: 300, top: 520, width: 380, height: 470 };
    // Thin electrode pin standing above the body, crossing the wall/table line.
    const pin = { left: 470, top: 330, width: 14, height: 190 };
    const rect = async (r: typeof body, c: typeof cream) =>
      sharp({ create: { width: r.width, height: r.height, channels: 3, background: c } }).png().toBuffer();
    const buf = await sharp(ramp, { raw: { width: W, height: H, channels: 3 } })
      .composite([
        { input: await rect(body, cream), left: body.left, top: body.top },
        { input: await rect(pin, { r: 198, g: 166, b: 84 }), left: pin.left, top: pin.top },
      ])
      .jpeg({ quality: 92 })
      .toBuffer();

    const analysis = await analyzeSubject(buf);
    expect(analysis.confident).toBe(true);
    // The pale body is found, not written off as more backdrop…
    expect(analysis.coverage).toBeGreaterThan(0.05);
    // …and the box reaches the pin rather than stopping at the body.
    expect(analysis.box.y0).toBeLessThanOrEqual(pin.top + 40);
    expect(analysis.box.y1).toBeGreaterThanOrEqual(body.top + body.height - 40);

    // And the planned crop never cuts it.
    const plan = planDisplayCrop(analysis, { x: analysis.focalX, y: analysis.focalY });
    expect(plan.crop.top).toBeLessThanOrEqual(analysis.box.y0 + 1);
    expect(plan.crop.top + plan.crop.height).toBeGreaterThanOrEqual(analysis.box.y1 - 1);
  });
});

describe("renderDisplay", () => {
  it("renders an exact 4:3 display file end to end", async () => {
    const rect = { left: 300, top: 500, width: 360, height: 420 };
    const buf = await photo(960, 1280, [rect]);
    const analysis = await analyzeSubject(buf);
    const plan = planDisplayCrop(analysis, { x: analysis.focalX, y: analysis.focalY });
    const out = await renderDisplay(buf, plan);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(DISPLAY_SIZE.width);
    expect(meta.height).toBe(DISPLAY_SIZE.height);
    expect(meta.format).toBe("webp");
  });

  it("leaves the canvas clear rather than inventing background", async () => {
    // Tall subject on a split background: no 4:3 window this portrait photo can
    // supply holds the product, so the whole photograph is shown and the flanks
    // stay transparent. Nothing is fabricated — that is the rule this asserts.
    const rect = { left: 200, top: 200, width: 560, height: 900 };
    const buf = await photo(960, 1280, [rect], { split: true });
    const analysis = await analyzeSubject(buf);
    const plan = planDisplayCrop(analysis, { x: analysis.focalX, y: analysis.focalY });
    expect(plan.scaled.width).toBeLessThan(DISPLAY_SIZE.width - 40); // real flanks
    const out = await renderDisplay(buf, plan);
    const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => {
      const o = (y * info.width + x) * info.channels;
      return { r: data[o]!, g: data[o + 1]!, b: data[o + 2]!, a: data[o + 3]! };
    };
    // Flanks: clear canvas, which the shop renders as the card's own background.
    expect(px(6, 600).a).toBe(0);
    expect(px(info.width - 7, 600).a).toBe(0);
    // The photograph itself is fully there, opaque, between them.
    expect(px(plan.place.left + 4, 600).a).toBe(255);
    expect(px(plan.place.left + plan.scaled.width - 5, 600).a).toBe(255);
    // The crop trims empty backdrop but never the subject…
    const b = analysis.box;
    expect(plan.crop.left).toBeLessThanOrEqual(b.x0);
    expect(plan.crop.top).toBeLessThanOrEqual(b.y0);
    expect(plan.crop.left + plan.crop.width).toBeGreaterThanOrEqual(b.x1);
    expect(plan.crop.top + plan.crop.height).toBeGreaterThanOrEqual(b.y1);
    // …and it is a real crop, not the whole photograph: keeping every inch of
    // empty backdrop is what shrinks the product to a third of the frame.
    expect(plan.crop.height).toBeLessThan(1280);
    // The product still lands at the standard size on the binding axis, which
    // is what keeps a portrait shot the same size as a landscape one. The bar
    // sits just under SUBJECT_OCCUPANCY so it tracks the catalogue standard
    // rather than pinning a number the standard has since moved past.
    const scale = plan.scaled.height / plan.crop.height;
    expect(((b.y1 - b.y0) * scale) / DISPLAY_SIZE.height).toBeGreaterThan(0.64);
  });
});
