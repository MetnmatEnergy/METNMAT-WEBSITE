import type { MongooseAdapter } from "@payloadcms/db-mongodb";
import type { Payload } from "payload";

/**
 * What the director bootstrap last applied, so the next boot can tell two
 * situations apart that look identical from the account alone:
 *
 *   - the director changed their PIN in the admin UI (the account's lookup no
 *     longer matches DIRECTOR_PIN; the environment is unchanged) — leave it;
 *   - the owner changed DIRECTOR_PIN in Secrets Manager (the account's lookup
 *     no longer matches; the environment DID change) — apply it.
 *
 * Seen in production on 2026-09-19: the owner saved a new DIRECTOR_PIN while
 * the CMS was still running with the old one. The next boot found an account
 * whose lookup did not match the new value and, having no way to know the
 * environment had moved, preserved the old PIN — so the value in Secrets
 * Manager, the one the owner was typing, still did not sign in.
 *
 * Only the LOOKUP of the applied PIN is stored (lib/pin.ts derivePinLookup),
 * never the PIN. Same collection-per-concern pattern as pin-throttle.ts; a raw
 * document rather than a Payload global so no schema or generated types move.
 */

const COLL = "cms_bootstrap_state";
const DIRECTOR_DOC = "director";

type StateDoc = { _id: string; appliedPinLookup?: string; updatedAt?: Date };

function collection(payload: Payload) {
  const adapter = payload.db as unknown as MongooseAdapter;
  return adapter.connection.getClient().db().collection<StateDoc>(COLL);
}

/** The lookup of the DIRECTOR_PIN the bootstrap last wrote, or undefined. */
export async function readAppliedDirectorLookup(payload: Payload): Promise<string | undefined> {
  try {
    const doc = await collection(payload).findOne({ _id: DIRECTOR_DOC });
    return typeof doc?.appliedPinLookup === "string" && doc.appliedPinLookup ? doc.appliedPinLookup : undefined;
  } catch {
    // Unreadable state reads as "never applied", which makes the environment
    // authoritative — the safer failure for the one account that must work.
    return undefined;
  }
}

export async function writeAppliedDirectorLookup(payload: Payload, lookup: string): Promise<void> {
  try {
    await collection(payload).updateOne(
      { _id: DIRECTOR_DOC },
      { $set: { appliedPinLookup: lookup, updatedAt: new Date() } },
      { upsert: true },
    );
  } catch (e) {
    payload.logger.warn(`[seed] could not record the applied director PIN: ${(e as Error).message}`);
  }
}
