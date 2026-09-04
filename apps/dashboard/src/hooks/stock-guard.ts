import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from "payload";
import { preserveStockFields } from "../lib/stock-math";
import { readAuthoritativeStock, recordOpeningBalance } from "../lib/stock";

/**
 * Stock is moved by the service, never by saving the product form.
 *
 * `lib/stock.ts` is the one place stock changes: it applies the movement
 * atomically and leaves a ledger row naming who moved it and why. It writes
 * through the native driver rather than Payload, so these hooks cannot see —
 * or recurse into — a service-driven change. Everything they do see is a
 * document save, and a document save must not move stock.
 *
 * Two holes are closed here.
 *
 *  1. THE FORM. `stockQty` and `reservedStock` were ordinary editable fields.
 *     Typing a number and pressing Save wrote past the ledger entirely, and
 *     because a save rewrites the whole document from a snapshot the browser
 *     read minutes ago, it could also silently undo a movement made in between.
 *     They are now read-only in the admin — but read-only is a UI affordance,
 *     and the REST API does not care about it, which is why the value is pinned
 *     server-side as well.
 *
 *  2. THE OPENING BALANCE. Stock set when a product is first created was
 *     invisible: the ledger began at the first movement, so the numbers never
 *     reconciled against it. A create now records where the count started.
 */

/**
 * What the product actually holds, or null if that cannot be established.
 *
 * `originalDoc` is the obvious thing to preserve from and the wrong one. For a
 * collection with drafts enabled Payload fills it from
 * `getLatestCollectionVersion`, which returns `latestVersion.version` — a
 * SNAPSHOT. Snapshots are written by `saveVersion`, which only runs on a Payload
 * save, while `lib/stock.ts` writes through the native driver and mints no
 * version. So a movement made through the ledger changes the document and
 * leaves every snapshot untouched, and preserving from one reverts the movement.
 *
 * Returning null on failure keeps the guard exactly as strong as it was before —
 * the caller falls back to the snapshot — rather than failing open.
 */
async function liveStock(
  req: Parameters<CollectionBeforeChangeHook>[0]["req"] | undefined,
  originalDoc: { id?: unknown } | undefined,
) {
  const id = originalDoc?.id;
  if (!id || !req?.payload) return null;

  try {
    return await readAuthoritativeStock(req.payload, String(id));
  } catch (err) {
    req.payload.logger?.warn(
      { err, product: id },
      "[stock] could not read the authoritative count — preserving from the version snapshot instead",
    );
    return null;
  }
}

/**
 * Discard any attempt to change stock through a document save.
 *
 * Create is exempt: the value entered on a new product is its opening balance,
 * and `recordOpeningStock` below writes the matching ledger row once the
 * product has an id.
 */
export const stockFieldsBeforeChange: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data || operation !== "update") return data;

  // A save that never mentions stock is a partial update that must be left
  // alone. Checking first also keeps every unrelated edit — which is most of
  // them — from paying for a database round trip.
  if (!("stockQty" in data) && !("reservedStock" in data)) return data;

  const original = (await liveStock(req, originalDoc)) ?? originalDoc;

  const { preserve, discarded } = preserveStockFields(data, original);
  Object.assign(data, preserve);

  if (discarded.length) {
    // Not silent. Someone tried to move stock the wrong way and should be able
    // to find out that it did not take.
    for (const d of discarded) {
      req?.payload?.logger?.warn(
        {
          product: originalDoc?.id,
          field: d.field,
          attempted: d.attempted,
          kept: d.kept,
          by: req?.user?.email ?? "unknown",
        },
        "[stock] discarded a direct field write — stock only moves through the ledger",
      );
    }
  }

  return data;
};

/**
 * Record the opening balance of a newly created product.
 *
 * Runs only on create, and only when there is something to record. A failure
 * here must never fail the product creation — the product is real whether or
 * not its first ledger row was written — so it is logged and swallowed.
 */
export const recordOpeningStock: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== "create") return doc;

  const opening = Number(doc?.stockQty);
  if (!Number.isFinite(opening) || opening <= 0) return doc;

  try {
    // Records, does not re-apply: the create has already written stockQty, so
    // moving the same quantity again would double it.
    await recordOpeningBalance(
      req.payload,
      {
        productId: String(doc.id),
        quantity: opening,
        ...(req.user?.id ? { userId: String(req.user.id) } : {}),
      },
      req,
    );
  } catch (err) {
    req.payload.logger.error({ err, product: doc.id }, "[stock] opening balance failed");
  }

  return doc;
};
