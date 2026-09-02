import type { MongooseAdapter } from "@payloadcms/db-mongodb";
import type { Payload } from "payload";

/**
 * Brute-force budget for PIN sign-in.
 *
 * WHAT WAS WRONG
 * The previous guard was an in-process Map, checked at the top of the handler
 * and only written after three awaits. Node interleaves requests at every await,
 * so every request in a concurrent burst read the same pre-burst counter before
 * any of them recorded a failure. The real per-window budget was therefore the
 * attacker's in-flight concurrency, not the 5 the design implied — a single IP
 * firing a few hundred concurrent requests walks the whole 10,000-PIN keyspace
 * in hours, and the window is fixed-start with no backoff, so the burst repeats
 * every fifteen minutes indefinitely. The counter also lived only in memory, so
 * a PM2 reload wiped every accumulated lockout mid-attack.
 *
 * WHAT THIS DOES
 * Counts in Mongo with a single atomic increment, BEFORE any credential work, so
 * there is no read-then-write window to race. Two budgets are charged per
 * attempt: one per IP, and one GLOBAL. The global row is the part rotating
 * addresses cannot spend around — PIN guessing has no legitimate high-volume
 * caller, so a site-wide ceiling costs real staff nothing.
 *
 * A TTL index is the window: Mongo deletes the row, so there is no reset logic
 * to get wrong and no unbounded table.
 *
 * DELIBERATELY FAILS OPEN
 * A Mongo error returns 0, which allows the attempt. The alternative locks the
 * sole director out of admin.metnmat.com during an Atlas blip, and losing admin
 * access to your own site is worse than a brief throttling gap. The rate limiter
 * on the website makes the same trade for the same reason.
 *
 * WHAT MUST NOT BE BUILT ON TOP OF THIS
 * Not per-ACCOUNT lockout. The PIN is the entire credential — there is no
 * username — so "lock the account after N failures" is reachable by any
 * anonymous caller and would hand them a permanent director lockout.
 * Not a budget on Payload's own email/password login, which is the break-glass
 * door the PIN screen falls back to.
 */

const COLL = "pin_login_throttle";
/** Mongo duplicate-key error. Two concurrent upserts on one new _id; one loses. */
const DUPLICATE_KEY = 11000;
const WINDOW_MS = 15 * 60 * 1000;

/** Per-IP attempts allowed in a window. */
export const MAX_PER_IP = 5;
/**
 * Attempts allowed across EVERY address in a window. Sized well above a bad day
 * for a handful of staff and far below what enumerating a 4-digit keyspace needs.
 */
export const MAX_GLOBAL = 40;

export const THROTTLE_WINDOW_MINUTES = Math.round(WINDOW_MS / 60000);

type ThrottleDoc = { _id: string; fails?: number; expiresAt?: Date };

function collection(payload: Payload) {
  // Same reuse of the live pooled connection as hooks/sync-chatbot.ts.
  const adapter = payload.db as unknown as MongooseAdapter;
  return adapter.connection.getClient().db().collection<ThrottleDoc>(COLL);
}

/** The TTL index IS the window. Ensured at boot beside the analytics indexes. */
export async function ensurePinThrottleIndex(payload: Payload): Promise<void> {
  await collection(payload).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

/**
 * Charge one attempt against a budget and return the running total.
 *
 * Returns 0 when the store is unreachable, which reads as "under budget"
 * everywhere it is used — see the fail-open note above.
 */
export async function countAttempt(payload: Payload, key: string): Promise<number> {
  /*
   * Two attempts, because of one specific and very relevant race.
   *
   * Concurrent upserts against the SAME not-yet-existing _id collide on the
   * unique index, and all but one lose with E11000. That is Mongo's documented
   * behaviour for concurrent upserts, and it lands exactly where it hurts most:
   * the FIRST burst against a cold key — which is precisely what a brute-force
   * attempt looks like.
   *
   * Measured against production after deploying the first version of this: a
   * burst of 12 produced only 2 rejections where 7 were expected, because the
   * losers hit the catch below and failed open. Retrying once fixes it, because
   * by then the row exists and the increment is an ordinary serialised update.
   *
   * A duplicate key is not a store failure — the write the loser wanted has, in
   * effect, already happened — so it must not be treated like one.
   */
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await collection(payload).findOneAndUpdate(
        { _id: key },
        {
          $inc: { fails: 1 },
          // Only on insert, so the window is fixed from the FIRST attempt and a
          // steady drip cannot keep pushing the expiry out ahead of itself.
          $setOnInsert: { expiresAt: new Date(Date.now() + WINDOW_MS) },
        },
        { upsert: true, returnDocument: "after" }
      );
      // Driver 6 returns the document; 4 and 5 wrap it in { value }.
      const doc = ((res as unknown as { value?: ThrottleDoc })?.value ?? res) as ThrottleDoc | null;
      return doc?.fails ?? 1;
    } catch (e) {
      const code = (e as { code?: number } | null)?.code;
      if (attempt === 0 && code === DUPLICATE_KEY) continue;
      return 0;
    }
  }
  return 0;
}

/** Forget one budget's attempts. Used for the IP row after a correct PIN. */
export async function clearAttempts(payload: Payload, key: string): Promise<void> {
  try {
    await collection(payload).deleteOne({ _id: key });
  } catch {
    /* non-fatal: the row expires on its own */
  }
}

export const ipKey = (ip: string): string => `ip:${ip}`;
/** The one budget an attacker cannot escape by changing address. */
export const GLOBAL_KEY = "global";

/**
 * Whether this attempt is over budget.
 *
 * Split out from the counting so it can be tested without a database, and so
 * the two ceilings are visible in one place rather than inline in the route.
 */
export function isOverBudget(ipFails: number, globalFails: number): boolean {
  return ipFails > MAX_PER_IP || globalFails > MAX_GLOBAL;
}
