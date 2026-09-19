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
  reason: DirectorPinDecision["reason"] | "credential-stale" | "pepper-changed" | "env-changed";
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
 *   2. Is that PIN the director's env PIN? If it is, check the hash really
 *      accepts it — and re-derive when it does not ("credential-stale").
 *   3. If it is NOT, someone changed something — but who? `appliedLookup` is
 *      the lookup of the DIRECTOR_PIN this bootstrap last wrote
 *      (lib/bootstrap-state.ts). If the environment's PIN differs from that,
 *      the OWNER changed the secret, and the secret wins ("env-changed").
 *      Otherwise the environment is as it was and the director chose a new PIN
 *      in the UI; that choice stands (the general resync pass repairs its hash
 *      if needed, without changing the PIN).
 *
 *      Seen 2026-09-19: the owner saved a new DIRECTOR_PIN while the CMS still
 *      ran with the old one. Without the record, the next boot could not tell
 *      that apart from a UI change and preserved the old PIN — so the value in
 *      Secrets Manager, the one being typed, still did not sign in. With no
 *      record at all (first boot after this shipped) the environment is
 *      treated as changed: the secret is authoritative once, which is what a
 *      DIRECTOR_PIN is for.
 *
 * Every write is safe by construction: it happens only when the PIN the
 * environment says the account should accept cannot currently sign in.
 */
export function decideDirectorCredential(input: {
  base: DirectorPinDecision;
  lookup: unknown;
  salt: unknown;
  hash: unknown;
  pin: string;
  /** Lookup of the DIRECTOR_PIN last applied by the bootstrap; undefined if never recorded. */
  appliedLookup: unknown;
}): DirectorCredentialDecision {
  if (input.base.write) return input.base;
  const envLookup = derivePinLookup(input.pin);
  if (input.lookup === envLookup) {
    return verifyDerivedCredential(derivePassword(input.pin), input.salt, input.hash)
      ? { write: false, reason: "preserved" }
      : { write: true, reason: "credential-stale" };
  }
  if (recoverPinFromLookup(input.lookup) === null) return { write: true, reason: "pepper-changed" };
  if (input.appliedLookup !== envLookup) return { write: true, reason: "env-changed" };
  return { write: false, reason: "preserved" };
}
