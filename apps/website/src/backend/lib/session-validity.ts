/**
 * Fail-open session validity: has this JWT been invalidated by a later password
 * change? A customer's `sessionsValidFrom` (epoch ms) is bumped whenever their
 * password changes; any token issued before it must be treated as signed-out, so
 * a stolen/old token stops working the moment the password is changed.
 *
 * The overriding rule is FAIL OPEN: this runs on every authenticated request, so
 * anything we cannot positively prove — no stamp on the account, an unreadable
 * `iat`, a malformed token — returns TRUE (still valid). Only a token whose
 * issued-at is demonstrably before the password change returns FALSE. A decode
 * quirk can therefore never mass-sign-out real customers.
 */

// The JWT `iat` is whole seconds; `sessionsValidFrom` is ms. A token minted in
// the same second as (or just after) the password change floors its `iat` down,
// so allow a small skew to keep the freshly-issued token valid.
export const SESSION_SKEW_MS = 5000;

export function tokenNotBeforeReset(
  token: string | null | undefined,
  sessionsValidFrom: number | null | undefined,
): boolean {
  if (typeof sessionsValidFrom !== "number" || !(sessionsValidFrom > 0)) return true; // never changed password
  if (!token) return true;
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const iat = (JSON.parse(json) as { iat?: number })?.iat;
    if (typeof iat !== "number") return true; // can't read iat → fail open
    return iat * 1000 >= sessionsValidFrom - SESSION_SKEW_MS;
  } catch {
    return true; // malformed token → fail open (never sign out on a decode error)
  }
}
