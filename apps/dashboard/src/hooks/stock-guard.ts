import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from "payload";
import { preserveStockFields } from "../lib/stock-math";
import { recordOpeningBalance } from "../lib/stock";

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

  const { preserve, discarded } = preserveStockFields(data, originalDoc);
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
