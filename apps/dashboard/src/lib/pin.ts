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

// ── Brute-force protection (in-memory, per server instance) ───────────────────
// 4 digits = 10,000 combinations, so throttling is essential. State resets on
// restart and is per-instance; for multi-instance deploys move this to Redis.
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 min lockout after MAX_FAILS
const WINDOW_MS = 15 * 60 * 1000; // failures older than this don't count

type Bucket = { fails: number; firstFailAt: number; lockedUntil: number };
const buckets = new Map<string, Bucket>();

export type LockState = { locked: boolean; minutes: number };

export function checkLock(key: string): LockState {
  const b = buckets.get(key);
  if (!b) return { locked: false, minutes: 0 };
  const now = Date.now();
  if (b.lockedUntil > now) {
    return { locked: true, minutes: Math.ceil((b.lockedUntil - now) / 60000) };
  }
  return { locked: false, minutes: 0 };
}

export function recordFailure(key: string): LockState {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.firstFailAt > WINDOW_MS) {
    buckets.set(key, { fails: 1, firstFailAt: now, lockedUntil: 0 });
    return { locked: false, minutes: 0 };
  }
  b.fails += 1;
  if (b.fails >= MAX_FAILS) {
    b.lockedUntil = now + LOCK_MS;
    return { locked: true, minutes: Math.ceil(LOCK_MS / 60000) };
  }
  return { locked: false, minutes: 0 };
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
