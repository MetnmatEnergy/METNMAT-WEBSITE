/**
 * Subject-aware DISPLAY derivative for product photographs.
 *
 * The stored file stays the untouched original — that is what the lightbox and
 * any download serve. The `display` image size (registered in Media.ts,
 * 1600 × 1200, exact 4:3) is what the shop grid, gallery and cards render:
 * Payload first generates it as a plain contain render, and for product
 * photography this hook REPLACES that buffer with a composition around the
 * detected subject — the smallest 4:3 window that fully contains the subject
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
import { analyzeSubject, planDisplayCrop, renderDisplay } from "../lib/product-image-analysis";
import { resolveStorageConfig } from "../lib/storage-config";

const CONTEXT_KEY = "_displayDerivative";

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

/** Fetch the stored original back through the CMS's own public media route. */
async function fetchStoredOriginal(filename: string): Promise<Buffer | null> {
  const origin = (process.env.CMS_URL || "http://localhost:3001").replace(/\/+$/, "");
  try {
    const res = await fetch(`${origin}/api/media/file/${encodeURIComponent(filename)}`);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
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

  if (req.file?.data) {
    original = req.file.data;
    isNewFile = true;
  } else if (operation === "update" && previous.filename && previous.sizes?.display?.filename) {
    // Focal-point correction without a new file → recompose around the choice.
    const focalMoved =
      (typeof doc.focalX === "number" && doc.focalX !== previous.focalX) ||
      (typeof doc.focalY === "number" && doc.focalY !== previous.focalY);
    if (!focalMoved) return data;
    original = await fetchStoredOriginal(previous.filename);
    if (!original) {
      req.payload.logger.warn(
        `[display] could not re-read "${previous.filename}" to recompose around the new focal point`
      );
      return data;
    }
  } else {
    return data;
  }

  try {
    const analysis = await analyzeSubject(original);
    if (!analysis.width || !analysis.height) return data;

    // A fresh file gets the detected focal point (staff can correct it later);
    // a focal-only edit keeps the staff's choice as the composition bias.
    let focalX = analysis.focalX;
    let focalY = analysis.focalY;
    if (isNewFile) {
      doc.focalX = focalX;
      doc.focalY = focalY;
    } else {
      focalX = typeof doc.focalX === "number" ? doc.focalX : previous.focalX ?? 50;
      focalY = typeof doc.focalY === "number" ? doc.focalY : previous.focalY ?? 50;
    }

    const plan = planDisplayCrop(
      analysis.width,
      analysis.height,
      analysis.box,
      { x: focalX, y: focalY },
      analysis.confident
    );
    const buf = await renderDisplay(original, plan);

    const sizes = { ...(doc.sizes ?? previous.sizes ?? {}) };
    const meta = { ...(sizes.display ?? {}) };
    if (!meta.filename) return data; // no registered display size → nothing to replace
    meta.filesize = buf.length;
    sizes.display = meta;
    doc.sizes = sizes;

    // Cloud storage persists data.sizes ∩ req.payloadUploadSizes — replace the
    // plain render's buffer with the composition.
    req.payloadUploadSizes = { ...(req.payloadUploadSizes ?? {}), display: buf };
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
    (req.context as Record<string, unknown>)[CONTEXT_KEY] = { filename: meta.filename, buf };

    req.payload.logger.info(
      `[display] ${meta.filename}: ${plan.mode} crop ${plan.crop.width}×${plan.crop.height} of ${analysis.width}×${analysis.height}` +
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
    | { filename: string; buf: Buffer }
    | undefined;
  if (!pending) return doc;
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
    await fs.writeFile(path.join(dir, pending.filename), pending.buf);
  } catch (e) {
    req.payload.logger.warn(`[display] local write failed: ${(e as Error).message}`);
  }
  return doc;
};
