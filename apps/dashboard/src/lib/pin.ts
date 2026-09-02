import { createHmac } from "crypto";

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

export const PIN_REGEX = /^\d{4}$/;

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
