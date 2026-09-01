import { describe, it, expect } from "vitest";
import sharp from "../apps/dashboard/node_modules/sharp/lib/index.js";
import {
  analyzeSubject,
  planDisplayCrop,
  renderDisplay,
  DISPLAY_SIZE,
  type Box,
} from "../apps/dashboard/src/lib/product-image-analysis";

/**
 * The display pipeline's promises, as invariants:
 *  - the subject is never cut (the crop contains the subject box),
 *  - nothing is ever distorted (crop and its scaled size share one aspect),
 *  - upscaling is capped (×2), the output canvas is always exactly 4:3,
 *  - degenerate detection falls back to the whole image instead of guessing.
 */

const aspect = (w: number, h: number): number => w / h;

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
  // Output canvas is the fixed 4:3 frame and the artwork fits inside it.
  expect(plan.out).toEqual({ width: DISPLAY_SIZE.width, height: DISPLAY_SIZE.height });
  expect(plan.scaled.width).toBeLessThanOrEqual(DISPLAY_SIZE.width);
  expect(plan.scaled.height).toBeLessThanOrEqual(DISPLAY_SIZE.height);
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
    const plan = planDisplayCrop(2400, 1800, subject, { x: 50, y: 47 });
    expect(plan.mode).toBe("subject");
    expectPlanInvariants(plan, 2400, 1800, subject);
    // Substantially tighter than the whole frame.
    expect(plan.crop.width).toBeLessThan(2400);
  });

  it("gives a portrait photo's subject the full 4:3 window height", () => {
    // 960×1280 portrait, compact centred subject — the old disease case.
    const subject: Box = { x0: 260, y0: 380, x1: 700, y1: 920 };
    const plan = planDisplayCrop(960, 1280, subject, { x: 50, y: 50 });
    expect(plan.mode).toBe("subject");
    expectPlanInvariants(plan, 960, 1280, subject);
    // The 4:3 window around this subject is wider than tall and roughly square
    // to the subject — nothing like the 3:4 whole frame.
    expect(aspect(plan.crop.width, plan.crop.height)).toBeGreaterThan(1);
  });

  it("pads instead of cutting when the subject spans the full portrait width", () => {
    const subject: Box = { x0: 10, y0: 100, x1: 950, y1: 1240 };
    const plan = planDisplayCrop(960, 1280, subject, { x: 50, y: 50 });
    expectPlanInvariants(plan, 960, 1280, subject);
    // Window wants 4:3 of the tall span → wider than the photo → crop clamps to
    // full width and the remainder becomes padding, never a cut.
    expect(plan.crop.width).toBe(960);
  });

  it("leans toward the focal point within the legal range", () => {
    const subject: Box = { x0: 900, y0: 700, x1: 1500, y1: 1100 };
    const left = planDisplayCrop(2400, 1800, subject, { x: 10, y: 50 });
    const right = planDisplayCrop(2400, 1800, subject, { x: 90, y: 50 });
    expectPlanInvariants(left, 2400, 1800, subject);
    expectPlanInvariants(right, 2400, 1800, subject);
    expect(left.crop.left).toBeLessThanOrEqual(right.crop.left);
  });

  it("falls back to the whole image when detection was not confident", () => {
    const plan = planDisplayCrop(960, 1280, { x0: 0, y0: 0, x1: 960, y1: 1280 }, undefined, false);
    expect(plan.mode).toBe("whole-image");
    expect(plan.crop).toEqual({ left: 0, top: 0, width: 960, height: 1280 });
    expectPlanInvariants(plan, 960, 1280);
  });
});

describe("analyzeSubject + renderDisplay", () => {
  const photo = async (w: number, h: number, rect?: { left: number; top: number; width: number; height: number }) => {
    const base = sharp({
      create: { width: w, height: h, channels: 3, background: { r: 245, g: 244, b: 240 } },
    });
    if (!rect) return base.jpeg().toBuffer();
    const subject = await sharp({
      create: { width: rect.width, height: rect.height, channels: 3, background: { r: 60, g: 62, b: 70 } },
    })
      .png()
      .toBuffer();
    return base.composite([{ input: subject, left: rect.left, top: rect.top }]).jpeg().toBuffer();
  };

  it("finds a dark object on a light background within tolerance", async () => {
    const rect = { left: 300, top: 500, width: 360, height: 420 };
    const analysis = await analyzeSubject(await photo(960, 1280, rect));
    expect(analysis.confident).toBe(true);
    expect(analysis.width).toBe(960);
    expect(analysis.height).toBe(1280);
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

  it("reports low confidence on a featureless image", async () => {
    const analysis = await analyzeSubject(await photo(800, 600));
    expect(analysis.confident).toBe(false);
    expect(analysis.box).toEqual({ x0: 0, y0: 0, x1: 800, y1: 600 });
  });

  it("renders an exact 4:3 display file end to end", async () => {
    const rect = { left: 300, top: 500, width: 360, height: 420 };
    const buf = await photo(960, 1280, rect);
    const analysis = await analyzeSubject(buf);
    const plan = planDisplayCrop(analysis.width, analysis.height, analysis.box, {
      x: analysis.focalX,
      y: analysis.focalY,
    }, analysis.confident);
    const out = await renderDisplay(buf, plan);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(DISPLAY_SIZE.width);
    expect(meta.height).toBe(DISPLAY_SIZE.height);
    expect(meta.format).toBe("webp");
  });
});
