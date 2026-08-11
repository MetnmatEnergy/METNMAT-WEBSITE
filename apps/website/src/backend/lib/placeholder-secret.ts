/**
 * The value Terraform writes into every AWS Secrets Manager secret at creation
 * (infra/aws/platform.tf). It is COMMITTED TO THIS REPOSITORY, so it is a
 * publicly-known string — which makes it strictly more dangerous than an unset
 * variable: an empty secret fails closed everywhere in this codebase, this one
 * fails open.
 *
 *   - INTERNAL_API_KEY holding it authenticates anyone who has read the repo.
 *   - PAYLOAD_SECRET holding it lets admin session JWTs be forged.
 *
 * Not hypothetical: on 2026-08-11 all 22 production secrets held this value while
 * every health signal reported the stack healthy.
 *
 * WHY THIS IS ITS OWN MODULE, WITH NO IMPORTS
 * instrumentation.ts is a Next.js special file and is compiled for the EDGE
 * runtime as well as Node. Importing this constant from internal-key.ts pulled
 * that file's `import { timingSafeEqual } from "crypto"` into the edge bundle and
 * broke the build outright:
 *
 *   ./src/backend/lib/internal-key.ts:1:1
 *   Module not found: Can't resolve 'crypto'
 *
 * So this module must stay dependency-free. Do not add imports to it.
 */
export const PLACEHOLDER_SECRET = "PLACEHOLDER_SET_ME";

/** True when a variable is unset, blank, or still the Terraform placeholder. */
export function isUnusableSecret(v: string | undefined): boolean {
  return !v || v.trim().length === 0 || v.trim() === PLACEHOLDER_SECRET;
}
