import { describe, it, expect } from "vitest";
import sharp from "../apps/dashboard/node_modules/sharp/lib/index.js";
import {
  generateDisplayDerivative,
  downscaleComposition,
} from "../apps/dashboard/src/hooks/product-display-derivative";

/**
 * The subject-aware composition has to reach the sizes the shop actually asks
 * for. It used to exist only at 1600w, while the grid requested `card` (800),
 * the cart `micro` (192) and even the 1× PDP stage `card` — so a staff member
 * could drag the focal point, save, and change nothing a customer sees, and
 * `srcset` advertised two different framings of one photograph as if they were
 * the same image at two resolutions.
 */

type Rect = { left: number; top: number; width: number; height: number };

/** A flat-lit catalogue photo: one dark product on a pale sweep. */
const photo = async (w: number, h: number, r: Rect): Promise<Buffer> =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 245, g: 244, b: 240 } } })
    .composite([
      {
        input: await sharp({
          create: {
            width: r.width,
            height: r.height,
            channels: 3,
            background: { r: 60, g: 62, b: 70 },
          },
        })
          .png()
          .toBuffer(),
        left: r.left,
        top: r.top,
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

/**
 * A catalogue MASTER: the same product on a genuinely clear canvas.
 *
 * `photo()` above is an opaque JPEG, which is what a photographer hands over and
 * is right for the framing assertions. It is the wrong input for asking whether
 * transparency SURVIVES a downscale, because it has none: every pixel is opaque,
 * so "the flanks stay clear" cannot be observed and the assertion passes or
 * fails for reasons unrelated to the code under test.
 *
 * The real masters are transparent WebP — scripts/normalize-product-images.ts
 * produces "2400x1800 WebP, transparent, never cropped", and a live `display`
 * derivative sampled from production reads alpha 0 at its edges. This mirrors
 * that.
 */
const transparentPhoto = async (w: number, h: number, r: Rect): Promise<Buffer> =>
  sharp({
    create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: await sharp({
          create: { width: r.width, height: r.height, channels: 4, background: { r: 60, g: 62, b: 70, alpha: 1 } },
        })
          .png()
          .toBuffer(),
        left: r.left,
        top: r.top,
      },
    ])
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();

/** Where the dark subject sits in a rendered frame, as fractions of that frame. */
async function subjectBox(buf: Buffer) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const o = (y * info.width + x) * info.channels;
      if (data[o + 3]! > 200 && data[o]! < 130 && data[o + 1]! < 130 && data[o + 2]! < 140) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  expect(x1).toBeGreaterThan(0); // the subject is somewhere in the frame
  return {
    width: (x1 - x0 + 1) / info.width,
    cx: (x0 + x1) / 2 / info.width,
    cy: (y0 + y1) / 2 / info.height,
  };
}

/** The ladder Payload records at upload (Media.ts), as it arrives at the hook. */
const LADDER = {
  micro: { filename: "p-192x144.webp", width: 192, height: 144, mimeType: "image/webp" },
  thumb: { filename: "p-320x240.webp", width: 320, height: 240, mimeType: "image/webp" },
  card: { filename: "p-800x600.webp", width: 800, height: 600, mimeType: "image/webp" },
  pdp: { filename: "p-1600x1200.webp", width: 1600, height: 1200, mimeType: "image/webp" },
  display: { filename: "p-display.webp", width: 1600, height: 1200, mimeType: "image/webp" },
};

const COMPOSED = ["card", "display", "micro", "thumb"] as const;

async function runUpload(file: Buffer) {
  const req = {
    file: { data: file, mimetype: "image/jpeg", name: "p.jpg", size: file.length },
    context: {} as Record<string, unknown>,
    payload: { logger: { info: () => {}, warn: () => {} } },
    payloadUploadSizes: {} as Record<string, Buffer>,
  };
  const data = {
    category: "product",
    filename: "p.webp",
    mimeType: "image/webp",
    sizes: structuredClone(LADDER) as Record<
      string,
      { filename: string; width: number; height: number; mimeType: string; filesize?: number }
    >,
  };
  const out = (await (generateDisplayDerivative as unknown as (a: unknown) => Promise<typeof data>)({
    data,
    operation: "create",
    req,
    collection: {},
    context: req.context,
  })) as typeof data;
  return { out, req };
}

describe("the composition reaches every rung the storefront requests", () => {
  const subject = { left: 300, top: 500, width: 360, height: 420 };

  it("rewrites micro, thumb, card and display — not display alone", async () => {
    const { req } = await runUpload(await photo(960, 1280, subject));
    expect(Object.keys(req.payloadUploadSizes).sort()).toEqual([...COMPOSED]);
    for (const name of COMPOSED) {
      const meta = await sharp(req.payloadUploadSizes[name]!).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([
        LADDER[name].width,
        LADDER[name].height,
        "webp",
      ]);
    }
  }, 30000);

  it("leaves pdp alone — display already supersedes it at 1600 on the storefront", async () => {
    const { req } = await runUpload(await photo(960, 1280, subject));
    expect(req.payloadUploadSizes.pdp).toBeUndefined();
  }, 30000);

  it("records the new filesize on each rewritten rung and keeps its filename", async () => {
    const { out, req } = await runUpload(await photo(960, 1280, subject));
    for (const name of COMPOSED) {
      expect(out.sizes[name]!.filesize).toBe(req.payloadUploadSizes[name]!.length);
      expect(out.sizes[name]!.filename).toBe(LADDER[name].filename);
    }
  }, 30000);

  it("frames the card exactly like the display, and unlike a plain contain render", async () => {
    const original = await photo(960, 1280, subject);
    const { req } = await runUpload(original);

    // Same picture at a different size — which is what srcset promises.
    const composed = await subjectBox(req.payloadUploadSizes.card!);
    const reference = await subjectBox(req.payloadUploadSizes.display!);
    expect(composed.width).toBeCloseTo(reference.width, 2);
    expect(composed.cx).toBeCloseTo(reference.cx, 2);
    expect(composed.cy).toBeCloseTo(reference.cy, 2);

    // …and it is genuinely the composition, not what Payload generated: the
    // plain contain render leaves the product a fraction of the card.
    const plain = await subjectBox(
      await sharp(original)
        .resize(800, 600, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 85 })
        .toBuffer()
    );
    expect(composed.width).toBeGreaterThan(plain.width * 1.5);
  }, 30000);

  it("downscales without matting the clear canvas onto black", async () => {
    // A transparent master, because that is what this asserts about. See
    // transparentPhoto() for why the opaque JPEG fixture cannot show it.
    const { req } = await runUpload(await transparentPhoto(960, 1280, subject));
    const small = await downscaleComposition(req.payloadUploadSizes.display!, 800, 600, 85);
    const { data, info } = await sharp(small).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]!;
    // A portrait photo cannot fill a 4:3 frame; the flanks stay clear, and the
    // shop paints its own card background through them.
    expect(alphaAt(2, 300)).toBe(0);
    expect(alphaAt(info.width - 3, 300)).toBe(0);
  }, 30000);
});