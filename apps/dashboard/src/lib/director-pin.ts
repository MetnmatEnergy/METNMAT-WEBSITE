/**
 * Whether the director bootstrap may write the PIN from `DIRECTOR_PIN`.
 *
 * WHAT THIS GUARDS. `ensureDirectorAccount()` runs inside `seed()`, which runs in
 * `onInit` on EVERY CMS boot — a deploy, a PM2 memory restart, anything. When it
 * found the director it issued an unconditional update including `pin`, so the
 * stored PIN was reset to the environment value on every restart. The function's
 * own docstring called that "fully idempotent"; it was not.
 *
 * ⚠ CORRECTION (2026-09-04). This guard was first written believing the restart
 * also reverted the LOGIN CREDENTIAL, and that this explained a production
 * lockout. It did not, and it could not have: a password assigned in a
 * collection `beforeChange` hook is dead code on update in Payload 3.85.1 — the
 * value is snapshotted before those hooks run. The credential was not being
 * reverted; it was frozen at whatever the account was CREATED with, and no PIN
 * change through any path had ever moved it. That separate defect is fixed in
 * `hooks/pin-credential.ts`, which carries the evidence.
 *
 * The correction makes this guard MORE load-bearing, not less. Until that fix,
 * seed's update could not change the credential whatever it wrote. Now it can —
 * so without the rule below, every restart really would overwrite a PIN the
 * director had set in the UI.
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
