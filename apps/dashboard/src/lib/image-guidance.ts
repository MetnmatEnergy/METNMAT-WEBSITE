/**
 * The image rules, stated once for the person uploading.
 *
 * The rules themselves are enforced elsewhere — the resolution floor in
 * hooks/product-image-spec.ts, the byte ceiling in lib/upload-limit.ts — but
 * both of those modules pull in server-only code (sharp, Payload's APIError),
 * so the admin's client-side readout cannot import them. This module holds the
 * same numbers with no dependencies, and test/admin-ui-guardrails.test.ts
 * asserts they still agree with the enforcing modules, so the hint can never
 * promise something the upload then refuses.
 */
export const IMAGE_GUIDANCE = {
  /** Product photographs: shortest side at least this (product-image-spec). */
  productMinShortSide: 900,
  /** The size the product gallery renders at full quality (4:3). */
  productBest: { width: 2400, height: 1800 },
  /** Hard ceiling for any upload (upload-limit). */
  maxMb: 25,
  /** Above this a product photo still uploads, but is worth re-exporting. */
  warnKb: 500,
  /** Raster formats the Media collection accepts. */
  formats: ["JPG", "PNG", "WebP", "AVIF"],
} as const;

export type ImageCheck = {
  /** "ok" uploads cleanly; "warn" uploads with a caveat; "bad" will be refused. */
  level: "ok" | "warn" | "bad";
  message: string;
};

/**
 * What to tell someone about the file they just picked. Pure, so the same
 * sentences can be unit-tested and reused by a script.
 *
 * `asProduct` is whether the Product Image category is (or will be) chosen —
 * the floor applies only there; a banner or a logo has no minimum.
 */
export function checkImageFile(
  file: { bytes: number; width?: number; height?: number },
  asProduct: boolean,
): ImageCheck {
  const g = IMAGE_GUIDANCE;
  if (file.bytes > g.maxMb * 1_000_000) {
    return { level: "bad", message: `Over the ${g.maxMb} MB limit — it will not be saved. Export it smaller and try again.` };
  }
  if (asProduct && file.width && file.height) {
    const shortSide = Math.min(file.width, file.height);
    if (shortSide < g.productMinShortSide) {
      return {
        level: "bad",
        message: `Shortest side is ${shortSide}px; product photos need at least ${g.productMinShortSide}px. Upload the camera original.`,
      };
    }
  }
  if (asProduct && file.bytes > g.warnKb * 1024) {
    return {
      level: "warn",
      message: `Large for the shop grid (over ${g.warnKb} KB). It will upload; re-exporting as WebP keeps pages fast on phones.`,
    };
  }
  return { level: "ok", message: asProduct ? "Meets the product photo requirements." : "Fine to upload." };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(bytes >= 10_000_000 ? 0 : 1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}
