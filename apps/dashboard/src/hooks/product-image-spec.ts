import type { CollectionBeforeValidateHook } from "payload";
import sharp from "sharp";
import { staffError } from "../lib/staff-error";

/**
 * Product photograph acceptance, enforced at upload time.
 *
 * Since the display-derivative pipeline (product-display-derivative.ts) the
 * stored file is the UNTOUCHED original — any orientation and ratio is welcome,
 * because presentation is handled by the generated `display` size, and the
 * lightbox deliberately shows the complete photograph. What still gets rejected
 * is a source too small to survive being looked at: the resolution floor keeps
 * genuine phone photos in and web-thumbnail rips out.
 */
export const PRODUCT_IMAGE_SPEC = {
  /** Shortest side a product photograph must have to stay sharp on the PDP. */
  minShortSide: 900,
  /** Above this we warn (not reject) — big files slow the shop grid on mobile. */
  warnBytes: 500 * 1024,
  /**
   * Legacy master geometry (4:3, ≥2400px wide) — no longer required at upload,
   * still used by scripts/normalize-product-images.ts for marketplace exports
   * and by the audit to recognise pre-pipeline masters.
   */
  ratio: 4 / 3,
  ratioTolerance: 0.01,
  minWidth: 2400,
} as const;

/** The current acceptance rule: is this photograph big enough to use at all? */
export function checkProductPhoto(width: number, height: number): { ok: boolean; shortSide: number } {
  const shortSide = Math.min(width, height);
  return { ok: shortSide >= PRODUCT_IMAGE_SPEC.minShortSide, shortSide };
}

/** Legacy master check (4:3 ≥2400) — normalizer output and the audit use it. */
export function checkProductMaster(
  width: number,
  height: number
): { ok: boolean; ratioOk: boolean; wideEnough: boolean; ratio: number } {
  const ratio = width / height;
  const ratioOk =
    Math.abs(ratio - PRODUCT_IMAGE_SPEC.ratio) / PRODUCT_IMAGE_SPEC.ratio <= PRODUCT_IMAGE_SPEC.ratioTolerance;
  const wideEnough = width >= PRODUCT_IMAGE_SPEC.minWidth;
  return { ok: ratioOk && wideEnough, ratioOk, wideEnough, ratio };
}

/**
 * Reject product images below the resolution floor; warn on oversized files.
 *
 * Scoped to `category === "product"` ONLY — banners, logos, blog art and user
 * uploads legitimately have other needs and must keep flowing through this same
 * collection. Non-image and metadata-only updates (no new file) pass straight
 * through, so editing alt text on an existing asset never trips the rule.
 */
export const enforceProductImageSpec: CollectionBeforeValidateHook = async ({ data, req }) => {
  const file = req.file;
  // No new binary → nothing to measure (alt-text edits, re-saves, bulk updates).
  if (!file?.data) return data;

  // Only police product photography. Anything else — including an absent
  // category — is out of scope. Media.category carries no default any more, so
  // an unset value means the staff member has not chosen yet, and the field's
  // own `required` rule reports exactly that, on the field, far more usefully
  // than a resolution-floor error about an image whose resolution was never the
  // problem. Collection beforeValidate runs before field validation, so
  // returning here lets that rule fire. On update Payload has already
  // back-filled `data.category` from the stored document during the field-level
  // beforeValidate pass (getFallbackValue prefers siblingDoc over
  // defaultValue), so an alt-text edit or a file replacement still sees the
  // real category here — which is also why scripts/recompose-display.ts can
  // send `data: {}` and still be recognised as a product photograph.
  const category = (data as Record<string, unknown> | undefined)?.category;
  if (category !== "product") return data;

  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = await sharp(file.data).metadata());
  } catch {
    // Unreadable/corrupt image: let Payload's own upload validation report it
    // rather than masking the real error behind a spec message.
    return data;
  }
  if (!width || !height) return data;

  const { ok, shortSide } = checkProductPhoto(width, height);
  if (!ok) {
    throw staffError(
      `Product photographs need a shortest side of at least ${PRODUCT_IMAGE_SPEC.minShortSide}px to stay sharp ` +
        `on the product page. Received ${width} × ${height} (shortest side ${shortSide}px). ` +
        `Upload the camera original rather than a messenger-app recompress.`
    );
  }

  if (file.size > PRODUCT_IMAGE_SPEC.warnBytes) {
    req.payload.logger.warn(
      `[media] "${file.name}" is ${(file.size / 1024).toFixed(0)} KB (over ${PRODUCT_IMAGE_SPEC.warnBytes / 1024} KB). ` +
        `It will still upload, but re-exporting as WebP q90 keeps the shop grid fast on mobile.`
    );
  }

  return data;
};
