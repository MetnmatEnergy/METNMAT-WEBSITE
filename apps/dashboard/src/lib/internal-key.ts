import { timingSafeEqual } from "crypto";

/**
 * The value Terraform writes into every AWS Secrets Manager secret at creation
 * (infra/aws/platform.tf). Committed to this repository, therefore PUBLIC. An
 * unset secret fails closed; this one fails OPEN, which makes it the more
 * dangerous of the two states. Mirrors the website's placeholder-secret.ts —
 * duplicated rather than shared because packages/types carries types only and
 * the two apps build independently.
 */
export const PLACEHOLDER_SECRET = "PLACEHOLDER_SET_ME";

/**
 * Constant-time secret comparison. A plain `===` on secrets leaks length and
 * matching-prefix length through response timing; this does not.
 *
 * The placeholder is rejected outright: inboundKeyMatches() below compares
 * against purpose-scoped variables that no boot check covers, so without this a
 * caller presenting the repository-published string would authenticate against a
 * placeholder-valued key. Two placeholders comparing equal is the fail-open case,
 * and it is exactly the state production was in on 2026-08-11.
 */
export function safeKeyEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === PLACEHOLDER_SECRET || b === PLACEHOLDER_SECRET) return false;
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
