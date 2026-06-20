import { timingSafeEqual } from "crypto";

/**
 * Constant-time secret comparison. A plain `===` on secrets leaks length and
 * matching-prefix length through response timing; this does not.
 */
export function safeKeyEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * The key VALUE to send for a server-to-server call of a given purpose: the
 * purpose-scoped key if configured, else the shared INTERNAL_API_KEY (so nothing
 * breaks before per-purpose keys are rolled out).
 */
export function outboundKey(purposeEnvVar: string): string {
  return process.env[purposeEnvVar] || process.env.INTERNAL_API_KEY || "";
}

/**
 * Verify an inbound key against a purpose-scoped key OR the shared
 * INTERNAL_API_KEY (timing-safe). Splitting keys per purpose limits blast radius;
 * the shared key remains accepted as a fallback until fully migrated, after which
 * INTERNAL_API_KEY can be removed for true isolation.
 */
export function inboundKeyMatches(provided: string | null | undefined, purposeEnvVar: string): boolean {
  return safeKeyEqual(provided, process.env[purposeEnvVar]) || safeKeyEqual(provided, process.env.INTERNAL_API_KEY);
}
