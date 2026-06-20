import { timingSafeEqual } from "crypto";

/**
 * Constant-time secret comparison. A plain `===`/`!==` on secrets leaks length
 * and matching-prefix length through timing; this does not.
 */
export function safeKeyEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Verify the inbound `x-internal-key` header against INTERNAL_API_KEY (timing-safe). */
export function verifyInternalKey(req: Request): boolean {
  return safeKeyEqual(req.headers.get("x-internal-key"), process.env.INTERNAL_API_KEY);
}

/**
 * The key VALUE to send for a server-to-server call of a given purpose: the
 * purpose-scoped key if configured, else the shared INTERNAL_API_KEY.
 */
export function outboundKey(purposeEnvVar: string): string {
  return process.env[purposeEnvVar] || process.env.INTERNAL_API_KEY || "";
}

/**
 * Verify an inbound key against a purpose-scoped key OR the shared
 * INTERNAL_API_KEY (timing-safe, fallback accepted until fully migrated).
 */
export function verifyKey(req: Request, purposeEnvVar: string): boolean {
  const provided = req.headers.get("x-internal-key");
  return safeKeyEqual(provided, process.env[purposeEnvVar]) || safeKeyEqual(provided, process.env.INTERNAL_API_KEY);
}
