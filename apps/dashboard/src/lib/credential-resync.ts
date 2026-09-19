import { derivePassword, recoverPinFromLookup, verifyDerivedCredential } from "./pin";

/**
 * Keep every staff account's login credential in step with its PIN.
 *
 * THE INVARIANT. For an account that signs in by PIN, Payload's stored password
 * hash must accept `derivePassword(pin)` under the CURRENT pepper, and its
 * `pinLookup` must equal `derivePinLookup(pin)` under that same pepper. Sign-in
 * needs both: the lookup to find the account, the password to mint the session.
 *
 * HOW IT BREAKS. Two ways have happened in production:
 *
 *   - The hash froze. Until hooks/pin-credential.ts (2026-09-04), a PIN change
 *     moved the lookup and left the hash where it was, so the new PIN found the
 *     account and could not sign in. Accounts edited before that fix still
 *     carry the frozen hash today.
 *   - The pepper changed. The September 2026 incident rotated
 *     PAYLOAD_PIN_PEPPER. Every lookup and hash minted under the old value is
 *     now inert; the migration that rebuilt lookups from the legacy cleartext
 *     column restored the lookups only. The director's hash was left behind, and
 *     the symptom — "Invalid key" for the right key — looked like user error.
 *
 * WHAT THIS DOES. At boot, for every account with a lookup, recover the PIN the
 * lookup encodes (lib/pin.ts, recoverPinFromLookup) and check the hash accepts
 * it. Where it does not, the caller re-saves the account with that PIN, which
 * runs the same hook path an admin edit does and re-derives the hash. The PIN
 * does not change; only the credential is brought back to it.
 *
 * Where NO PIN produces the lookup, the lookup predates the current pepper.
 * The PIN is unrecoverable by design, so the account is reported for a
 * super-admin to reset — except the director, whose PIN the environment
 * supplies and whose account ensureDirectorAccount repairs before this runs.
 *
 * Pure: takes rows, returns a plan. The recovered PIN travels inside the plan
 * only so the caller can hand it to Payload; nothing here or in the caller
 * logs it.
 */

export type StaffCredentialRow = {
  id: string | number;
  name?: unknown;
  email?: unknown;
  pinLookup?: unknown;
  salt?: unknown;
  hash?: unknown;
};

export type CredentialResyncAction =
  | { id: string | number; label: string; kind: "no-pin" }
  | { id: string | number; label: string; kind: "ok" }
  | { id: string | number; label: string; kind: "unreachable" }
  | { id: string | number; label: string; kind: "resync"; pin: string };

/** Something to call the account in a log line that is not a credential. */
export function accountLabel(row: StaffCredentialRow): string {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (name) return name;
  const email = typeof row.email === "string" ? row.email.trim() : "";
  return email || String(row.id);
}

export function planCredentialResync(rows: StaffCredentialRow[]): CredentialResyncAction[] {
  return rows.map((row) => {
    const label = accountLabel(row);
    const lookup = typeof row.pinLookup === "string" && row.pinLookup ? row.pinLookup : null;
    if (!lookup) return { id: row.id, label, kind: "no-pin" };
    const pin = recoverPinFromLookup(lookup);
    if (pin === null) return { id: row.id, label, kind: "unreachable" };
    if (verifyDerivedCredential(derivePassword(pin), row.salt, row.hash)) {
      return { id: row.id, label, kind: "ok" };
    }
    return { id: row.id, label, kind: "resync", pin };
  });
}
