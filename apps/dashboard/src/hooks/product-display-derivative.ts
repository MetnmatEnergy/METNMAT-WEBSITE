/**
 * Subject-aware DISPLAY derivative for product photographs.
 *
 * The stored file stays the untouched original — that is what the lightbox and
 * any download serve. The `display` image size (registered in Media.ts,
 * 1600 × 1200, exact 4:3) is where the composition is PLANNED; the smaller
 * rungs the shop actually requests — `card` (800) for the grid and the 1×
 * PDP stage, `thumb`/`micro` for the cart rail and the homepage mosaic — are
 * then downscaled from it, so every size a customer can be served is the same
 * picture. Composing only `display` is what this hook used to do, and it meant
 * the framing reached almost nobody.
 * Payload first generates each of them as a plain contain render, and for
 * product photography this hook REPLACES those buffers with a composition
 * around the detected subject — the smallest 4:3 window that fully contains the subject
 * plus breathing room, biased toward the focal point, padded transparently for
 * whatever the photo cannot supply. Only background is ever cropped; nothing is
 * distorted. See lib/product-image-analysis.ts for the analysis itself.
 *
 * Integration notes (verified against the installed packages):
 *  - `req.payloadUploadSizes` is Payload's typed map of generated size buffers.
 *    The cloud-storage plugin persists `data.sizes ∩ req.payloadUploadSizes`
 *    in a beforeChange hook that runs AFTER collection hooks, so replacing the
 *    buffer here is what S3 stores.
 *  - Local disk (dev) freezes its write list BEFORE hooks run, so the replaced
 *    buffer is handed to afterChange via req.context and written over the
 *    plain render there (afterChange runs after core's writes).
 *
 * Correction loop: `focalPoint: true` already gives staff a draggable focal
 * point in the admin UI. On create/re-upload the detected centroid is written
 * to focalX/focalY; when staff later move the point (no new file), the display
 * derivative is recomposed from the stored original around their choice.
 *
 * Failure policy: any analysis/render failure logs and leaves Payload's plain
 * contain render standing — an upload is never rejected by the composer.
 */
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from "payload";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { analyzeSubject, planDisplayCrop, renderDisplay } from "../lib/product-image-analysis";
import { resolveStorageConfig } from "../lib/storage-config";

const CONTEXT_KEY = "_displayDerivative";

/**
 * The rungs BELOW `display` that the storefront actually requests, each with
 * the quality it was configured with in Media.ts.
 *
 * `pdp` and `zoom` stay UNCOMPOSED deliberately, and after this change they are
 * the only uncropped rungs left. `mediaVariants(media, { uncroppedOnly })` in the
 * website's cms.ts is what feeds the lightbox, and it skips the composed set —
 * micro, thumb, card and display — so pdp, zoom and the stored original are all
 * it has to offer. Compose either of them and the one view that promises the
 * complete photograph has nothing uncropped left to show.
 *
 * `pdp` also never reaches a customer directly: it is 1600 wide like `display`,
 * and the website ladder dedupes by width with `display` winning.
 */
const SMALL_RUNGS = [
  ["micro", 82],
  ["thumb", 82],
  ["card", 85],
] as const;

/**
 * One smaller rung, downscaled from the composed 1600×1200 buffer rather than
 * re-planned from the original — so every rung is the IDENTICAL picture at a
 * different size, which is what `srcset` promises the browser.
 *
 * `fit: "contain"` is a no-op at these exactly-4:3 targets; it only guards a
 * future ladder entry that is not 4:3, and the transparent background keeps the
 * clear canvas clear instead of matting it onto black.
 */
export async function downscaleComposition(
  display: Buffer,
  width: number,
  height: number,
  quality: number
): Promise<Buffer> {
  return sharp(display)
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality })
    .toBuffer();
}

type SizeMeta = { filename?: string; width?: number; height?: number; mimeType?: string; filesize?: number };
type MediaLike = {
  category?: string;
  filename?: string;
  mimeType?: string;
  focalX?: number;
  focalY?: number;
  sizes?: Record<string, SizeMeta | undefined>;
};

const storageIsLocal = (): boolean => {
  try {
    return (
      resolveStorageConfig(process.env, {
        isProduction: process.env.NODE_ENV === "production",
        isBuildPhase: false,
      }).provider === "local"
    );
  } catch {
    return false;
  }
};

/**
 * Fetch the stored original back through the CMS's own public media route;
 * on local-disk storage fall back to reading the file directly, so recompose
 * scripts work without a running server.
 */
async function fetchStoredOriginal(filename: string): Promise<Buffer | null> {
  const origin = (process.env.CMS_URL || "http://localhost:3001").replace(/\/+$/, "");
  try {
    const res = await fetch(`${origin}/api/media/file/${encodeURIComponent(filename)}`);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  } catch {
    /* fall through to disk */
  }
  if (storageIsLocal()) {
    try {
      return await fs.readFile(path.resolve(process.cwd(), "media", filename));
    } catch {
      return null;
    }
  }
  return null;
}

export const generateDisplayDerivative: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const doc = (data ?? {}) as MediaLike;
  const previous = (originalDoc ?? {}) as MediaLike;
  const category = doc.category ?? previous.category;
  if (category !== "product") return data;

  let original: Buffer | null = null;
  let isNewFile = false;

  // A recompose request (scripts/recompose-display.ts) re-runs the automatic
  // pipeline on the stored original — including fresh subject detection, which
  // re-seeds the focal point.
  // `true` re-detects and re-seeds the focal point. "keep-focal" recomposes
  // around the point already stored, which is what a ladder backfill over media
  // staff have ALREADY corrected has to do — a re-detect would silently discard
  // every hand-dragged focal point in the library, i.e. destroy exactly the work
  // this fix exists to make visible.
  const mode = (req.context as Record<string, unknown> | undefined)?.recomposeDisplay;
  const forced = mode === true || mode === "keep-focal";
  const keepFocal = mode === "keep-focal";

  if (req.file?.data) {
    original = req.file.data;
    isNewFile = true;
  } else if (operation === "update" && previous.filename && previous.sizes?.display?.filename) {
    // Focal-point correction without a new file → recompose around the choice.
    const focalMoved =
      (typeof doc.focalX === "number" && doc.focalX !== previous.focalX) ||
      (typeof doc.focalY === "number" && doc.focalY !== previous.focalY);
    if (!focalMoved && !forced) return data;
    original = await fetchStoredOriginal(previous.filename);
    if (!original) {
      req.payload.logger.warn(
        `[display] could not re-read "${previous.filename}" to recompose the display derivative`
      );
      return data;
    }
  } else {
    return data;
  }

  try {
    const analysis = await analyzeSubject(original);
    if (!analysis.width || !analysis.height) return data;

    // A fresh file (and a forced recompose) gets the detected focal point —
    // staff can correct it later; a focal-only edit keeps the staff's choice
    // as the composition bias.
    let focalX = analysis.focalX;
    let focalY = analysis.focalY;
    if (isNewFile || (forced && !keepFocal)) {
      doc.focalX = focalX;
      doc.focalY = focalY;
    } else {
      focalX = typeof doc.focalX === "number" ? doc.focalX : previous.focalX ?? 50;
      focalY = typeof doc.focalY === "number" ? doc.focalY : previous.focalY ?? 50;
    }

    const plan = planDisplayCrop(analysis, { x: focalX, y: focalY });
    const buf = await renderDisplay(original, plan);

    const sizes = { ...(doc.sizes ?? previous.sizes ?? {}) };
    const meta = { ...(sizes.display ?? {}) };
    if (!meta.filename) return data; // no registered display size → nothing to replace
    meta.filesize = buf.length;
    sizes.display = meta;

    // Cloud storage persists data.sizes ∩ req.payloadUploadSizes — replace the
    // plain render's buffer with the composition.
    const uploads: Record<string, Buffer> = { ...(req.payloadUploadSizes ?? {}), display: buf };
    const written: { filename: string; buf: Buffer }[] = [{ filename: meta.filename, buf }];

    // …and every smaller rung, for the same reason. The composition used to live
    // ONLY at 1600w, and almost nothing asks for 1600: the shop grid requests
    // `card` (800), the cart rail and homepage mosaic `micro`/`thumb`, and even
    // the PDP stage picks `card` on a 1× display. All of those were Payload's
    // plain contain render, so a staff member could drag the focal point, save,
    // and see no change anywhere a customer looks — and `srcset` was offering the
    // browser two DIFFERENT framings of one photo, re-composing the picture in
    // place when the viewport crossed a breakpoint.
    //
    // These slots already exist on every file in the library, so this needs no
    // new imageSize and no re-upload (Payload only generates sizes at upload
    // time); scripts/recompose-display.ts --all backfills what is already there.
    for (const [name, quality] of SMALL_RUNGS) {
      const rung = sizes[name];
      if (!rung?.filename || !rung.width || !rung.height) continue;
      const small = await downscaleComposition(buf, rung.width, rung.height, quality);
      sizes[name] = { ...rung, filesize: small.length };
      uploads[name] = small;
      written.push({ filename: rung.filename, buf: small });
    }

    doc.sizes = sizes;
    req.payloadUploadSizes = uploads;
    if (!isNewFile && !storageIsLocal()) {
      // No incoming file on a focal edit — hand the plugin the original back so
      // its collector runs; it re-puts the (identical) main file plus display.
      req.file = {
        data: original,
        mimetype: previous.mimeType ?? "image/webp",
        name: previous.filename ?? "original",
        size: original.length,
      };
    }

    // Local disk writes happen from a list frozen before hooks — hand the
    // buffer to afterChange, which runs after those writes and can overwrite.
    (req.context as Record<string, unknown>)[CONTEXT_KEY] = written;

    req.payload.logger.info(
      `[display] ${meta.filename}: ${plan.mode} crop ${plan.crop.width}×${plan.crop.height} of ${analysis.width}×${analysis.height}` +
        (analysis.tiltDeg ? `, tilt ${analysis.tiltDeg.toFixed(1)}°` : "") +
        (analysis.confident
          ? ` (subject ${(analysis.coverage * 100).toFixed(0)}% of frame)`
          : " (low confidence — whole image kept)")
    );
    return doc;
  } catch (e) {
    req.payload.logger.warn(
      `[display] derivative generation failed: ${(e as Error).message} — the plain contain render stands`
    );
    return data;
  }
};

/** Local-dev half of the pipeline: overwrite the plain render on disk. */
export const writeDisplayDerivativeLocally: CollectionAfterChangeHook = async ({ collection, doc, req }) => {
  const pending = (req.context as Record<string, unknown>)[CONTEXT_KEY] as
    | { filename: string; buf: Buffer }[]
    | undefined;
  if (!pending?.length) return doc;
  delete (req.context as Record<string, unknown>)[CONTEXT_KEY];
  if (!storageIsLocal()) return doc;
  try {
    const staticDir =
      collection && typeof collection.upload === "object" ? collection.upload.staticDir : undefined;
    const dir = staticDir
      ? path.isAbsolute(staticDir)
        ? staticDir
        : path.resolve(process.cwd(), staticDir)
      : path.resolve(process.cwd(), "media");
    for (const file of pending) await fs.writeFile(path.join(dir, file.filename), file.buf);
  } catch (e) {
    req.payload.logger.warn(`[display] local write failed: ${(e as Error).message}`);
  }
  return doc;
};
