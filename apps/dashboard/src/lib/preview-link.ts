import crypto from "crypto";
import { PLACEHOLDER_SECRET } from "./internal-key";

/**
 * Signed, expiring draft-preview links for the storefront.
 *
 * WHY: the admin Preview button used to link straight at the public product
 * URL. The storefront gates reads to `_status: published`, so the button 404'd
 * for exactly the documents it exists to show — an unpublished product, or an
 * unpublished edit to a published one. Blog articles already solve this
 * (Posts.admin.preview -> /api/blog/preview); this is the same handshake,
 * factored out of the collection so the signer and the verifier can be
 * unit-tested against each other.
 *
 * The token authorises NOTHING on its own. It only asks the website to turn on
 * Next.js draft mode; the draft READ is authorised separately, by the website
 * server presenting the internal key to the CMS.
 */
export const PREVIEW_TTL_MS = 60 * 60 * 1000; // 1 hour

/** True when a secret is unset, blank, or still the Terraform placeholder. */
export function isUnusableSecret(v: string | null | undefined): boolean {
  return !v || v.trim().length === 0 || v.trim() === PLACEHOLDER_SECRET;
}

/** HMAC over "<slug>.<exp>" — byte-identical on both sides of the handshake. */
export function previewSignature(slug: string, exp: number | string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${slug}.${exp}`).digest("hex");
}

/**
 * Where the Preview button should point.
 *
 * With a usable shared secret: the website's draft-preview route, which enables
 * draft mode and redirects to /shop/p/<slug>, so drafts render.
 *
 * Without one (local dev, an unpopulated secret): the plain public URL — i.e.
 * exactly today's behaviour. A signed link whose signature can never be checked
 * would 401 every time, which is strictly worse than the bug it replaces.
 */
export function productPreviewUrl(args: {
  slug: string;
  websiteUrl: string;
  secret?: string | null;
  now?: number;
}): string {
  const base = (args.websiteUrl || "").replace(/\/+$/, "");
  if (isUnusableSecret(args.secret)) return `${base}/shop/p/${args.slug}`;
  const exp = (args.now ?? Date.now()) + PREVIEW_TTL_MS;
  const sig = previewSignature(args.slug, exp, args.secret as string);
  return `${base}/api/shop/preview?slug=${encodeURIComponent(args.slug)}&exp=${exp}&sig=${sig}`;
}
