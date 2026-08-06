/**
 * Decides whether a Payload REST response may be handed to a shared cache.
 *
 * Split out of the route handler purely so it can be tested: the handler
 * imports `@payload-config` and cannot boot inside a unit test, and this rule
 * is the security boundary — it decides what a CDN edge is allowed to keep and
 * replay to a different visitor.
 */

/**
 * `media` is the ONLY upload collection with `read: publicRead`
 * (collections/Media.ts) and the only one that answers anonymously with 200.
 * Every other upload collection is access-controlled and must never carry a
 * `public` cache directive:
 *
 *   documents             403 to an anonymous request
 *   enquiry-uploads       staff, or the website server via x-internal-key
 *   blog-submission-files "NEVER public — unpublished manuscripts"
 *
 * The regex is anchored at the start and includes the trailing slash so that
 * neither a lookalike collection (`/api/media-private/file/`) nor a nested
 * path that merely contains the segment can match.
 */
const PUBLIC_MEDIA_FILE = /^\/api\/media\/file\/[^/]/;

/** One year, immutable. Payload de-duplicates filenames, so a given URL's bytes do not change. */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function shouldCacheMedia(input: {
  pathname: string;
  status: number;
  /** Whether the upstream response already set its own Cache-Control. */
  hasCacheControl: boolean;
}): boolean {
  // Only successful responses. Caching a 404 for a year would outlive the
  // upload that fixes it, and caching a 401/403 could pin an authorization
  // failure for a user who is entitled to the file.
  if (input.status !== 200) return false;
  // Never override an explicit upstream decision.
  if (input.hasCacheControl) return false;
  return PUBLIC_MEDIA_FILE.test(input.pathname);
}
