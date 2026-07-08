import type { CollectionBeforeChangeHook } from "payload";

/**
 * Customer code assignment — the single, origin-agnostic place that mints a
 * permanent METNMAT member id for every storefront account.
 *
 * Format: `MNM-U-YY-000001`
 *   MNM     METNMAT
 *   U       Website user
 *   YY      2-digit signup year (IST) — the serial resets each year
 *   000001  six-digit zero-padded yearly serial
 *
 * The serial comes from an atomic Mongo `$inc` on a per-year counter document,
 * so two concurrent signups (email + Google) can never receive the same number.
 * This hook lives on the `customers` collection, which is written by BOTH the
 * website email-signup (REST create) and the Google first-login (payload.create
 * in the /oauth endpoint) — so both paths get a code with zero per-route code.
 */

// IST (Asia/Kolkata) is a fixed UTC+5:30 offset with no DST. We apply it
// explicitly so the year digit never depends on the server timezone (Cloud Run
// runs in UTC) — otherwise a late-December IST signup would carry next year's YY.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Two-digit signup year in IST for a given instant (e.g. 2026 → "26"). */
export function istYear2(at: Date = new Date()): string {
  return String(new Date(at.getTime() + IST_OFFSET_MS).getUTCFullYear()).slice(-2);
}

/** Compose a customer code from a 2-digit year and a serial. */
export function formatUserCode(year2: string, seq: number): string {
  return `MNM-U-${year2}-${String(seq).padStart(6, "0")}`;
}

/** The counter key for a given signup year. */
export function userCodeCounterKey(year2: string): string {
  return `customer-userCode-${year2}`;
}

/** Minimal shape of the Mongoose model reached through Payload's Mongo adapter. */
type CountersModel = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => Promise<{ seq?: number } | null>;
};

/**
 * The `counters` Mongoose model, off Payload's Mongo adapter. Same accessor the
 * blog like/dislike counters use (BlogReactions.ts) — the raw model lets us run
 * a single atomic server-side `$inc`, which Payload's read-modify-write
 * update() cannot guarantee.
 */
export function countersModel(db: unknown): CountersModel {
  return (db as { collections: Record<string, CountersModel> }).collections["counters"];
}

/**
 * Atomically increment and return the next value for a counter key. `$inc` under
 * `upsert` is atomic per document, so each caller gets a distinct number. A rare
 * upsert race can surface as a duplicate-key (11000) on the unique `key` index —
 * we retry once, which then hits the existing doc and increments cleanly.
 */
export async function bumpCounter(counters: CountersModel, key: string): Promise<number> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const doc = await counters.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const seq = doc?.seq ?? 0;
      if (seq) return seq;
    } catch (e) {
      if ((e as { code?: number })?.code !== 11000 || attempt === 1) throw e;
    }
  }
  throw new Error(`[customer-code] could not obtain a sequence for '${key}'`);
}

/**
 * Assign the code on CREATE; keep it immutable on every UPDATE.
 * - create: always mint a fresh code (never trust a client-supplied `userCode` —
 *   public registration means a registrant could otherwise post one).
 * - update: force the field back to the stored value so it can never be changed
 *   or spoofed. Records with no code yet (legacy, pre-backfill) simply have any
 *   incoming `userCode` stripped — only the server-side backfill assigns theirs.
 */
export const assignUserCode: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  const d = (data ?? {}) as Record<string, unknown>;

  if (operation !== "create") {
    const existing = (originalDoc as { userCode?: string } | undefined)?.userCode;
    if (existing) d.userCode = existing;
    else delete d.userCode;
    return d;
  }

  const year2 = istYear2();
  const seq = await bumpCounter(countersModel(req.payload.db), userCodeCounterKey(year2));
  d.userCode = formatUserCode(year2, seq);
  return d;
};
