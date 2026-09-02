import { describe, it, expect } from "vitest";
import {
  isOverBudget,
  ipKey,
  GLOBAL_KEY,
  MAX_PER_IP,
  MAX_GLOBAL,
  THROTTLE_WINDOW_MINUTES,
} from "../apps/dashboard/src/lib/pin-throttle";

/**
 * CMS staff sign-in is a 4-digit PIN with no username, so the throttle is the
 * only thing between the internet and a staff session.
 *
 * The old guard was an in-process Map, CHECKED at the top of the route and only
 * WRITTEN three awaits later. Node interleaves at every await, so every request
 * in a concurrent burst read the same pre-burst counter before any of them
 * recorded a failure: the real per-window budget was the attacker's in-flight
 * concurrency, not the five it looked like. The first test below is that race,
 * written out.
 */

describe("the race that made the old guard ineffective", () => {
  /** Check-then-act across an await, which is what the route used to do. */
  async function checkThenAct(concurrency: number, limit: number): Promise<number> {
    let counter = 0;
    let allowed = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const seen = counter; // check
        await Promise.resolve(); // the route's `await req.json()` / `payload.find`
        if (seen >= limit) return;
        allowed++;
        counter++; // ...act, far too late
      })
    );
    return allowed;
  }

  /** Increment-then-test, atomic, which is what Mongo's $inc gives us. */
  async function incrementThenTest(concurrency: number, limit: number): Promise<number> {
    let counter = 0;
    let allowed = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const after = ++counter; // one indivisible step
        await Promise.resolve();
        if (after <= limit) allowed++;
      })
    );
    return allowed;
  }

  it("let a whole concurrent burst through, not five of it", async () => {
    // 200 concurrent guesses against a budget of 5.
    expect(await checkThenAct(200, 5)).toBe(200);
  });

  it("is fixed by counting first — the burst gets exactly the budget", async () => {
    expect(await incrementThenTest(200, 5)).toBe(5);
  });

  it("still admits the legitimate attempts when there is no burst", async () => {
    expect(await incrementThenTest(3, 5)).toBe(3);
  });
});

describe("budgets", () => {
  it("stops an address after its own allowance", () => {
    expect(isOverBudget(MAX_PER_IP, 0)).toBe(false);
    expect(isOverBudget(MAX_PER_IP + 1, 0)).toBe(true);
  });

  it("stops the whole endpoint after the global allowance, however addresses are spread", () => {
    // The one ceiling rotating IPs cannot spend around: each new address starts
    // at 1 per-IP, but every attempt still charges the shared row.
    expect(isOverBudget(1, MAX_GLOBAL)).toBe(false);
    expect(isOverBudget(1, MAX_GLOBAL + 1)).toBe(true);
  });

  it("FAILS OPEN on a zero, which is what a store error returns", () => {
    // An Atlas blip must never lock the sole director out of their own admin.
    expect(isOverBudget(0, 0)).toBe(false);
  });

  it("keeps the global ceiling far below a 4-digit keyspace but above real use", () => {
    expect(MAX_GLOBAL).toBeGreaterThan(MAX_PER_IP);
    // 10,000 combinations: the ceiling must not make enumeration practical.
    expect(MAX_GLOBAL).toBeLessThan(100);
  });

  it("separates the per-address rows from the shared one", () => {
    expect(ipKey("203.0.113.7")).not.toBe(GLOBAL_KEY);
    expect(ipKey("203.0.113.7")).not.toBe(ipKey("203.0.113.8"));
    // The prefix stops an address literally named "global" colliding with it.
    expect(ipKey("global")).not.toBe(GLOBAL_KEY);
  });

  it("locks for a window a person would notice and an attacker would feel", () => {
    expect(THROTTLE_WINDOW_MINUTES).toBe(15);
  });
});

// ── The cold-key upsert race ─────────────────────────────────────────────────

/**
 * Found by measuring production, not by reading the code.
 *
 * After the atomic counter went live, a burst of 12 concurrent attempts produced
 * only 2 rejections where 7 were expected. Concurrent upserts against the same
 * not-yet-existing _id collide on the unique index and all but one lose with
 * E11000 — Mongo's documented behaviour — and those losers were hitting the
 * fail-open catch. It lands exactly where it hurts most: the first burst against
 * a cold key, which is what a brute-force attempt looks like.
 */
describe("countAttempt retries a duplicate-key collision", () => {
  /** Minimal stand-in for the chain countAttempt walks to reach the collection. */
  function fakePayload(findOneAndUpdate: () => Promise<unknown>) {
    const coll = { findOneAndUpdate, createIndex: async () => "", deleteOne: async () => ({}) };
    return {
      db: { connection: { getClient: () => ({ db: () => ({ collection: () => coll }) }) } },
    } as never;
  }

  it("retries once when the upsert loses the insert race, instead of failing open", async () => {
    const { countAttempt } = await import("../apps/dashboard/src/lib/pin-throttle");
    let calls = 0;
    const payload = fakePayload(async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      return { fails: 7 };
    });
    // 7 is over the per-IP budget, so this attempt must be rejected — the whole
    // point. Failing open would have returned 0 and let it through.
    expect(await countAttempt(payload, "ip:203.0.113.1")).toBe(7);
    expect(calls).toBe(2);
  });

  it("still fails OPEN on a real store error, so Atlas trouble cannot lock out the director", async () => {
    const { countAttempt } = await import("../apps/dashboard/src/lib/pin-throttle");
    const payload = fakePayload(async () => {
      throw Object.assign(new Error("connection timed out"), { code: 89 });
    });
    expect(await countAttempt(payload, "ip:203.0.113.2")).toBe(0);
  });

  it("gives up after ONE retry rather than looping on a persistent collision", async () => {
    const { countAttempt } = await import("../apps/dashboard/src/lib/pin-throttle");
    let calls = 0;
    const payload = fakePayload(async () => {
      calls++;
      throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    });
    expect(await countAttempt(payload, "ip:203.0.113.3")).toBe(0);
    expect(calls).toBe(2);
  });

  it("reads the count through the older driver's { value } wrapper too", async () => {
    const { countAttempt } = await import("../apps/dashboard/src/lib/pin-throttle");
    const payload = fakePayload(async () => ({ value: { fails: 3 } }));
    expect(await countAttempt(payload, "ip:203.0.113.4")).toBe(3);
  });
});
