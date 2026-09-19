import { createHmac, pbkdf2Sync, timingSafeEqual } from "crypto";

/**
 * 4-digit PIN login support.
 *
 * Employees sign in with a unique 4-digit key instead of email + password.
 * We don't reinvent sessions: each user's *real* Payload password is set to a
 * strong value DERIVED from their PIN (see Users.beforeChange), so the PIN
 * login endpoint can reuse Payload's own `login()` (JWT + httpOnly cookie).
 * The raw PIN is never the password — only its HMAC is — and is never logged.
 */

const PEPPER = process.env.PAYLOAD_PIN_PEPPER || process.env.PAYLOAD_SECRET || "metnmat-dev-pepper";

/** Deterministic strong password derived from a 4-digit PIN. */
export function derivePassword(pin: string): string {
  return createHmac("sha256", PEPPER).update(`metnmat:pin:${pin}`).digest("hex");
}

/**
 * The value stored in place of the PIN, so sign-in can still find an account by
 * equality without the credential itself being in the database.
 *
 * WHY THE LABEL DIFFERS FROM derivePassword. This value is STORED, in the clear,
 * in the same document as the password hash. If it were the same derivation, the
 * database would hold the account's actual pre-hash password in plaintext —
 * strictly worse than the four digits it replaced. The distinct label makes the
 * two outputs independent: knowing the stored lookup tells you nothing about the
 * password, and neither reveals the PIN.
 *
 * Determinism is the point. Sign-in derives the lookup from the submitted PIN
 * and matches on equality, so the field stays indexable and the login path does
 * not change shape.
 *
 * This is not a substitute for a slow hash. Four digits is 10,000 candidates, so
 * anyone holding the database AND the pepper can enumerate it — the pepper is
 * what they must not have, which is why its length matters (see
 * docs/upgrade/pin-pepper-rotation.md).
 */
export function derivePinLookup(pin: string): string {
  return createHmac("sha256", PEPPER).update(`metnmat:pinlookup:${pin}`).digest("hex");
}

export const PIN_REGEX = /^\d{4}$/;

/**
 * Payload's own local-strategy hashing parameters, mirrored so a stored
 * credential can be checked in-process at boot. Verified against the installed
 * package in test/pin-credential-resync.test.ts, so a Payload bump that changes
 * them fails a test rather than silently marking every account stale.
 *
 *   auth/strategies/local/authenticate.js
 *     crypto.pbkdf2(password, salt, 25000, 512, 'sha256', ...)
 */
export const PAYLOAD_PBKDF2 = { iterations: 25000, keyLength: 512, digest: "sha256" } as const;

/**
 * Does this stored salt/hash pair accept `password`?
 *
 * The only reader of an account's `salt` + `hash` outside Payload itself. It
 * exists because the credential and the PIN can fall out of step, and when they
 * do the symptom is indistinguishable from a wrong PIN: sign-in finds the
 * account by its lookup, hands Payload the derived password, and Payload says
 * no. Seen in production after the September 2026 pepper rotation — the
 * director's lookup was current, the hash was still the one minted under the
 * old pepper, and "Invalid key" was all anyone got. Checking here is what lets
 * boot tell "stale" apart from "wrong" and repair the former.
 */
export function verifyDerivedCredential(password: string, salt: unknown, hash: unknown): boolean {
  if (typeof salt !== "string" || typeof hash !== "string" || !salt || !hash) return false;
  const computed = pbkdf2Sync(
    password,
    salt,
    PAYLOAD_PBKDF2.iterations,
    PAYLOAD_PBKDF2.keyLength,
    PAYLOAD_PBKDF2.digest,
  ).toString("hex");
  if (computed.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

/**
 * The PIN a stored lookup was derived from under the CURRENT pepper, or null
 * when no PIN produces it — which means it was derived under a different
 * pepper and the account cannot be reached by PIN at all.
 *
 * Yes, this is the enumeration lib/pin.ts warns about: four digits is 10,000
 * candidates, and whoever holds the database AND the pepper can walk them. At
 * boot, that is this process. It uses the fact deliberately and only for
 * repair — the recovered PIN is handed straight back to Payload to re-derive
 * the credential and is never logged, stored or returned to a request. Cost
 * is ~10k HMACs, a few milliseconds per account.
 */
export function recoverPinFromLookup(lookup: unknown): string | null {
  if (typeof lookup !== "string" || !lookup) return null;
  for (let i = 0; i < 10_000; i++) {
    const pin = String(i).padStart(4, "0");
    if (derivePinLookup(pin) === lookup) return pin;
  }
  return null;
}

// ── Brute-force protection lives in pin-throttle.ts ─────────────────────────
// It used to be an in-memory Map here, CHECKED at the top of the route and only
// WRITTEN three awaits later. Node interleaves at every await, so a concurrent
// burst from one address all passed the check before any of them recorded a
// failure — the real budget was the attacker's in-flight concurrency, not the
// five this intended. It also lived only in process memory, so a PM2 reload
// wiped every accumulated lockout mid-attack.
//
// Replaced by an atomic, Mongo-persisted, per-IP AND global budget. Do not
// reintroduce a read-then-write counter on an async path.
