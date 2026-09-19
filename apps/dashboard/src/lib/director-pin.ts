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

import { derivePassword, derivePinLookup, recoverPinFromLookup, verifyDerivedCredential } from "./pin";

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

export type DirectorCredentialDecision = {
  write: boolean;
  reason: DirectorPinDecision["reason"] | "credential-stale" | "pepper-changed";
};

/**
 * The PIN-preserving rule above, extended to notice when preserving would keep
 * a credential that does not work.
 *
 * WHAT THE RULE ALONE MISSED (production, 2026-09-19). The director's account
 * had a lookup, so the rule said "preserved" on every boot — correctly, by its
 * own lights. But the account's password hash had been minted under the pepper
 * the September incident burned, and nothing had re-derived it since: PIN edits
 * were a no-op on update until hooks/pin-credential.ts, and this bootstrap had
 * stopped writing the PIN by design. Sign-in found the account by its (current)
 * lookup, handed Payload a password derived under the new pepper, and Payload
 * refused. Every restart preserved the lockout.
 *
 * So "already has a PIN" is not enough to leave the account alone. Two more
 * questions, in order:
 *
 *   1. Does its lookup match ANY PIN under the current pepper? If not, it was
 *      derived under a previous one and no PIN can reach the account. The only
 *      PIN this process knows is DIRECTOR_PIN, so write it ("pepper-changed").
 *   2. Is that PIN the director's env PIN? If they chose a different one in the
 *      UI, that choice stands (the general resync pass repairs its hash if
 *      needed, without changing the PIN). If it IS the env PIN, check the hash
 *      really accepts it — and re-derive when it does not ("credential-stale").
 *
 * Both writes are safe by construction: they happen only when the PIN the
 * account is meant to accept cannot currently sign in, so there is nothing
 * working to break — which is also why the 2026-09-04 rule is honoured
 * unchanged whenever the credential verifies.
 */
export function decideDirectorCredential(input: {
  base: DirectorPinDecision;
  lookup: unknown;
  salt: unknown;
  hash: unknown;
  pin: string;
}): DirectorCredentialDecision {
  if (input.base.write) return input.base;
  const intended = input.lookup === derivePinLookup(input.pin) ? input.pin : recoverPinFromLookup(input.lookup);
  if (intended === null) return { write: true, reason: "pepper-changed" };
  if (intended !== input.pin) return { write: false, reason: "preserved" };
  if (verifyDerivedCredential(derivePassword(input.pin), input.salt, input.hash)) {
    return { write: false, reason: "preserved" };
  }
  return { write: true, reason: "credential-stale" };
}
