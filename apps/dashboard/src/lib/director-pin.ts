/**
 * Whether the director bootstrap may write the PIN from `DIRECTOR_PIN`.
 *
 * THE BUG THIS FIXES. `ensureDirectorAccount()` runs inside `seed()`, which runs
 * in `onInit` on EVERY CMS boot — a deploy, a PM2 memory restart, anything. When
 * it found the director it issued an unconditional update including `pin`, and
 * `Users.beforeChange` keeps the real password in lockstep by deriving it from
 * the PIN. So a PIN changed in the admin UI was silently reverted to the
 * environment value on the next restart, and the person who set it was locked
 * out with no indication of why. Observed in production on 2026-09-04: a PIN set
 * in the UI stopped working the moment a deploy restarted the CMS.
 *
 * The function's own docstring claimed it was "fully idempotent". It was not:
 * idempotent means running it twice changes nothing, and this changed the
 * credential every time.
 *
 * THE RULE NOW, which matches what the rest of this codebase already does —
 * globals seed only when unset, products are never updated once created:
 *
 *   - no PIN on the account  → write it, so a fresh install can be provisioned
 *   - a PIN already set      → leave it alone
 *   - DIRECTOR_PIN_FORCE     → write it anyway, the deliberate break-glass path
 *
 * The force flag matters. Without it, losing the PIN would mean losing the
 * account, because the password is an HMAC of the PIN and there is no
 * human-typable value to fall back on. It is opt-in so that recovering access is
 * something an operator chooses, not something a restart does to them.
 */

export type DirectorPinDecision = {
  write: boolean;
  reason: "no-existing-pin" | "forced" | "preserved";
};

export function decideDirectorPinWrite(
  existingPin: unknown,
  force: boolean,
): DirectorPinDecision {
  const hasPin = typeof existingPin === "string" && existingPin.trim() !== "";
  if (!hasPin) return { write: true, reason: "no-existing-pin" };
  if (force) return { write: true, reason: "forced" };
  return { write: false, reason: "preserved" };
}

/** Read the break-glass flag. Explicit string compare — never truthiness. */
export function directorPinForced(env: Record<string, string | undefined>): boolean {
  return env.DIRECTOR_PIN_FORCE === "true";
}
