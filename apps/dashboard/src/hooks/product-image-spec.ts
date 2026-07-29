import type { CollectionBeforeValidateHook } from "payload";
import sharp from "sharp";

/**
 * Product image specification, enforced at upload time.
 *
 * One master file per product renders in every location on the site — shop grid,
 * PDP gallery, zoom, cart, search — with no per-location cropping. That only
 * holds if every master shares one ratio, so this rejects anything that doesn't.
 */
export const PRODUCT_IMAGE_SPEC = {
  /** 4:3 — matches the aspect-[4/3] frame every product surface renders in. */
  ratio: 4 / 3,
  /** ±1%: enough for a rounding-off-by-one-pixel export, not enough to letterbox. */
  ratioTolerance: 0.01,
  /** Must survive full-bleed zoom on a retina desktop without upscaling. */
  minWidth: 2400,
  /** Above this we warn (not reject) — big files slow the shop grid on mobile. */
  warnBytes: 500 * 1024,
} as const;

/**
 * The single source of truth for "is this a valid product master?". Used by the
 * upload hook (to reject) and by scripts/audit-product-images.ts (to report), so
 * the admin and the audit can never disagree about what passes.
 */
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

const fmt = (w: number, h: number): string => {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(w, h) || 1;
  return `${w} × ${h} (${w / d}:${h / d})`;
};

/**
 * Reject product images that aren't 4:3 / ≥2400px wide; warn on oversized files.
 *
 * Scoped to `category === "product"` ONLY — banners, logos, blog art and user
 * uploads legitimately have other shapes and must keep flowing through this same
 * collection. Non-image and metadata-only updates (no new file) pass straight
 * through, so editing alt text on an existing asset never trips the rule.
 */
export const enforceProductImageSpec: CollectionBeforeValidateHook = async ({ data, req, operation }) => {
  const file = req.file;
  // No new binary → nothing to measure (alt-text edits, re-saves, bulk updates).
  if (!file?.data) return data;

  // Only police product photography. On update the category may be absent from
  // the patch, so fall back to the incoming doc's value.
  const category = (data as Record<string, unknown> | undefined)?.category;
  if (category !== undefined && category !== "product") return data;
  if (category === undefined && operation === "create") return data;

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

  const { ratioOk, wideEnough } = checkProductMaster(width, height);

  if (!ratioOk) {
    throw new Error(
      `Product images must be 4:3 and at least ${PRODUCT_IMAGE_SPEC.minWidth} × ${PRODUCT_IMAGE_SPEC.minWidth * 3 / 4} px. ` +
        `Received ${fmt(width, height)}. ` +
        `Run: npx tsx scripts/normalize-product-images.ts <in> <out> — it pads any photo onto a 2400 × 1800 transparent canvas without cropping.`
    );
  }

  if (!wideEnough) {
    throw new Error(
      `Product images must be 4:3 and at least ${PRODUCT_IMAGE_SPEC.minWidth} × ${PRODUCT_IMAGE_SPEC.minWidth * 3 / 4} px. ` +
        `Received ${fmt(width, height)} — the ratio is right but it is too small to stay sharp in the zoom viewer.`
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
