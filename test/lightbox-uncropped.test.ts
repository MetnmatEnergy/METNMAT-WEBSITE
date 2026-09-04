import { describe, it, expect } from "vitest";
import { mediaAtLeast, mediaSrcSet, mediaVariants } from "../apps/website/src/frontend/lib/cms";

/**
 * The bug this guards against.
 *
 * The Media ladder has one COMPOSED entry: `display`, whose buffer the
 * display-derivative hook replaces with a subject-aware crop for product
 * photography. It is the only size configured `withoutEnlargement: false`, so
 * Payload always generates it; `pdp` and `zoom` are omitted outright when the
 * source is smaller than the target in both axes
 * (payload/dist/uploads/image-resizing/getImageResizeAction.js).
 *
 * Once the upload gate dropped to a 900px shortest side, a legitimate product
 * photo at, say, 1200x900 produced micro/thumb/card, no pdp, no zoom, and a
 * 1600x1200 `display` upscaled from 1200px and then cropped. The composed crop
 * was therefore the WIDEST file in the ladder — so `mediaAtLeast(m, 2400)`,
 * which falls back to the largest variant, returned it, and the lightbox
 * srcset topped out at it too. A customer clicking to zoom got a cropped,
 * upscaled render in the one view that promises the untouched photograph.
 */

const F = "https://cms.example/api/media/file/";
const omitted = { url: null, width: null } as never;

/** 1200x900 — admitted by the 900px gate, below every plain size above `card`. */
const sub2400 = {
  url: `${F}pump.webp`,
  width: 1200,
  height: 900,
  alt: "Pump",
  sizes: {
    micro: { url: `${F}pump-192x144.webp`, width: 192 },
    thumb: { url: `${F}pump-320x240.webp`, width: 320 },
    card: { url: `${F}pump-800x600.webp`, width: 800 },
    pdp: omitted,
    zoom: omitted,
    display: { url: `${F}pump-1600x1200.webp`, width: 1600 },
  },
};

/** 3000x2250 — a full master; every size generated. */
const master = {
  url: `${F}cell.webp`,
  width: 3000,
  height: 2250,
  alt: "Cell",
  sizes: {
    micro: { url: `${F}cell-192x144.webp`, width: 192 },
    thumb: { url: `${F}cell-320x240.webp`, width: 320 },
    card: { url: `${F}cell-800x600.webp`, width: 800 },
    pdp: { url: `${F}cell-1600x1200.webp`, width: 1600 },
    zoom: { url: `${F}cell-2400x1800.webp`, width: 2400 },
    display: { url: `${F}cell-display-1600x1200.webp`, width: 1600 },
  },
};

describe("the lightbox never serves the composed crop", () => {
  it("a sub-2400 source zooms to the stored original, not the display crop", () => {
    // Before the fix this returns the 1600x1200 display file.
    expect(mediaAtLeast(sub2400, 2400, { uncroppedOnly: true })).toBe(`${F}pump.webp`);
  });

  it("offers the browser no candidate it could resolve to a crop", () => {
    // With the composed rungs skipped, a 1200x900 source has exactly ONE
    // uncropped candidate left — the stored original — so there is no srcset at
    // all and the `src` is what renders. That is the correct outcome, not a
    // missing feature: a one-entry srcset is pointless, and every other rung
    // available for this image is either composed or an upscale.
    expect(mediaSrcSet(sub2400, { uncroppedOnly: true })).toBeUndefined();

    const variants = mediaVariants(sub2400, { uncroppedOnly: true });
    expect(variants).toEqual([{ url: `${F}pump.webp`, width: 1200 }]);
    // Specifically: the 1600w display crop is gone, and nothing wider than the
    // 1200px source is offered, so no upscale is ever fetched.
    expect(variants.some((v) => v.url.includes("pump-1600x1200.webp"))).toBe(false);
    expect(Math.max(...variants.map((v) => v.width))).toBe(1200);
  });

  it("a full master keeps a real uncropped ladder: pdp, zoom, original", () => {
    // The counterpart case. Skipping the composed rungs must not collapse a
    // proper master down to one candidate — 1600 and 2400 are plain
    // fit:"contain" renders and stay in.
    const variants = mediaVariants(master, { uncroppedOnly: true });
    expect(variants.map((v) => v.width)).toEqual([1600, 2400, 3000]);
    expect(variants.some((v) => v.url.includes("display"))).toBe(false);
    expect(mediaSrcSet(master, { uncroppedOnly: true })).toContain("cell-2400x1800.webp 2400w");
  });

  it("a full master is unchanged: the plain zoom derivative still wins", () => {
    expect(mediaAtLeast(master, 2400, { uncroppedOnly: true })).toBe(`${F}cell-2400x1800.webp`);
    expect(mediaAtLeast(master, 2400)).toBe(`${F}cell-2400x1800.webp`);
  });
});

describe("the gallery surfaces still get the composed crop", () => {
  it("the PDP stage keeps preferring `display` over `pdp` at 1600", () => {
    expect(mediaAtLeast(master, 1600)).toBe(`${F}cell-display-1600x1200.webp`);
    expect(mediaAtLeast(sub2400, 1600)).toBe(`${F}pump-1600x1200.webp`);
  });

  it("the stage srcset still carries the whole ladder", () => {
    expect(mediaSrcSet(master) ?? "").toContain("cell-display-1600x1200.webp");
  });
});
