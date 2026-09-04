import { createHmac, timingSafeEqual } from "crypto";
import { isUnusableSecret } from "./placeholder-secret";

/** CMS slugs come from slugify(): lowercase letters, digits and hyphens only. */
const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Verify a signed draft-preview token minted by the CMS
 * (apps/dashboard/src/lib/preview-link.ts).
 *
 * Fails CLOSED on an unset or placeholder secret: without that check both sides
 * would HMAC with "" and every forged link would verify. A forged link still
 * could not read a draft (the CMS checks the key separately), but a token that
 * silently enables draft mode for anonymous visitors is not a state worth
 * having.
 */
export function previewTokenValid(args: {
  slug: string;
  exp: string;
  sig: string;
  secret: string | undefined;
  now?: number;
}): boolean {
  const { slug, exp, sig, secret } = args;
  if (isUnusableSecret(secret)) return false;
  if (!slug || slug.length > 200 || !SLUG_RE.test(slug)) return false;
  const expMs = Number(exp);
  if (!exp || !Number.isFinite(expMs) || (args.now ?? Date.now()) > expMs) return false;
  const want = Buffer.from(createHmac("sha256", secret as string).update(`${slug}.${exp}`).digest("hex"));
  const got = Buffer.from(sig || "");
  if (want.length !== got.length) return false;
  return timingSafeEqual(want, got);
}
