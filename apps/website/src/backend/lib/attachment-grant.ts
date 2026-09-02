import { createHmac, timingSafeEqual } from "crypto";

/**
 * Proof that the caller is the person who uploaded a given attachment.
 *
 * WHAT WAS WRONG
 * `/api/quote` took `attachmentIds` straight off the request body, read each one
 * back through `fetchEnquiryFileBase64()` — which authenticates to the CMS with
 * `INTERNAL_API_KEY` and therefore satisfies the staff-only read gate on
 * `enquiry-uploads` — and attached the bytes to an email addressed to whatever
 * address was in the same untrusted body. Nothing tied an id to the session that
 * created it, and `EnquiryUploads` has no owner field with which it could have.
 * So: upload one file to the public upload endpoint to learn the shape of a live
 * id, walk the neighbouring ObjectIds (4-byte timestamp + per-process random +
 * sequential counter), and have other customers' drawings and purchase orders
 * mailed to you.
 *
 * WHAT THIS CHANGES
 * The upload endpoint now returns a signed grant alongside the id, and the
 * submit endpoints accept only the grant. The signature is over the id and an
 * expiry, so a grant cannot be minted, edited or transplanted onto a different
 * id client-side. Possession of a grant is the ownership proof the data model
 * does not provide: it is handed only to the uploader, in the response to their
 * own upload.
 *
 * This is deliberately NOT a session binding. The quote form is public and used
 * by signed-out visitors, so there is no session to bind to. Holding the grant
 * is the claim, exactly as it is for the draft-preview links in
 * `api/blog/preview` and the visitor tokens in `blog-visitor.ts`.
 */

/** Mongo ObjectId. Also what stops an id being used to inject a URL path. */
export const OBJECT_ID = /^[a-f0-9]{24}$/;

/** Long enough to fill in a form at leisure, short enough to bound replay. */
const TTL_MS = 12 * 60 * 60 * 1000;

/** Longest plausible grant: 24 + 13 + 32 + separators. Bounds parser work. */
const MAX_TOKEN_LENGTH = 128;

/**
 * No development fallback constant.
 *
 * `blog-visitor.ts` can afford `"dev-blog-secret"` because forging a visitor
 * token only lets someone fake a reaction. Forging one of these reads a private
 * customer file, so an absent secret must fail closed rather than fall back to a
 * value that is published in the source. `INTERNAL_API_KEY` is already required
 * for the readback to work at all, so this adds no new deployment requirement.
 */
const secret = (): string =>
  process.env.ATTACHMENT_SIGNING_SECRET || process.env.INTERNAL_API_KEY || "";

const sign = (id: string, exp: string, key: string): string =>
  createHmac("sha256", key).update(`${id}.${exp}`).digest("base64url").slice(0, 32);

/** A grant for an id the caller just uploaded, or null if it cannot be signed. */
export function mintAttachmentGrant(id: string, now: number = Date.now()): string | null {
  const key = secret();
  if (!key || !OBJECT_ID.test(id)) return null;
  const exp = String(now + TTL_MS);
  return `${id}.${exp}.${sign(id, exp, key)}`;
}

/** The id inside a grant, or null if it is missing, malformed, forged or expired. */
export function verifyAttachmentGrant(token: unknown, now: number = Date.now()): string | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }
  const key = secret();
  if (!key) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, mac] = parts;

  // Check the id BEFORE the MAC so a malformed id can never reach a URL even if
  // the signature somehow validated.
  if (!OBJECT_ID.test(id)) return null;

  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || now > expMs) return null;

  const want = Buffer.from(sign(id, exp, key));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return id;
}

/**
 * Verify a client-supplied list of grants into ids that may be used.
 *
 * Capped and deduped as well as verified: the id list drove a sequential
 * two-request readback per entry, so an unbounded list was also a way to make
 * one cheap public request do unbounded server-to-server work. Duplicates are
 * dropped because the same file attached five times is five copies in the email.
 */
export function collectGrantedIds(
  raw: unknown,
  max: number,
  now: number = Date.now()
): { ids: string[]; rejected: number } {
  if (!Array.isArray(raw)) return { ids: [], rejected: 0 };

  const ids: string[] = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (const token of raw) {
    const id = verifyAttachmentGrant(token, now);
    if (!id) {
      rejected++;
      continue;
    }
    if (seen.has(id)) continue;
    if (ids.length >= max) {
      rejected++;
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return { ids, rejected };
}
