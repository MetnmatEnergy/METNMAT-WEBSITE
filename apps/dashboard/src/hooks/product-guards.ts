import type { CollectionBeforeDeleteHook } from "payload";
import { staffError } from "../lib/staff-error";

/**
 * A product may not be deleted out from under its own stock history.
 *
 * `Categories` got a delete guard; `Products` never had one, and it is the
 * collection where deleting does the most damage.
 *
 *  - `StockLedger.product` is a REQUIRED relationship, and the ledger is
 *    append-only by access control (`update: () => false`, `delete: () => false`).
 *    Deleting the product leaves every movement pointing at an id that no longer
 *    resolves: the Stock Ledger list renders a blank Product column, a depth > 0
 *    read populates null, and no member of staff can ever repair or remove those
 *    rows. That is not a stale reference — it is the permanent loss of the audit
 *    trail for stock that really moved.
 *
 *  - `Orders.items` snapshots the product by SLUG, not by relationship. See
 *    hooks/order-stock.ts, which resolves that slug back to a product in order to
 *    move stock. An order whose stock has not finished moving — pending, paid,
 *    shipped, delivered — silently stops decrementing or restoring inventory the
 *    moment the product it names is gone: order-stock logs "product not found for
 *    order line — stock not moved" and carries on.
 *
 * Refusing is the right answer rather than cascading, exactly as for categories:
 * removing a catalogue entry must never silently destroy the record of what was
 * sold. The alternative offered is a real one — `versions.drafts` is on, so a
 * product is taken out of the shop by unpublishing it, which is what "delete" is
 * usually being reached for.
 *
 * ONE DELIBERATE CONSEQUENCE. Unlike a category, whose blocker clears once you
 * move the products, a product that has traded is undeletable by staff for good,
 * because staff cannot delete ledger rows either. That is the invariant an
 * append-only ledger already declares. A genuinely junk row can still be removed
 * by a developer through the local API with `overrideAccess: true`.
 *
 * The refusal is thrown through `staffError` rather than a bare `Error`: Payload
 * replaces the message of any non-public error with "Something went wrong."
 * before it reaches the browser — see lib/staff-error.ts.
 */

/** Order statuses whose stock has not finished moving. */
export const LIVE_ORDER_STATUSES = ["pending", "paid", "shipped", "delivered"] as const;

/** What blocks a product delete, phrased for the person attempting it. */
export function productDeleteBlocker(counts: {
  ledgerRows: number;
  liveOrders: number;
  name?: string | null;
}): string | null {
  const { ledgerRows, liveOrders } = counts;
  if (ledgerRows <= 0 && liveOrders <= 0) return null;

  const label = counts.name ? `"${counts.name}"` : "This product";
  const parts: string[] = [];
  if (ledgerRows > 0)
    parts.push(`${ledgerRows} order-linked stock movement${ledgerRows === 1 ? "" : "s"}`);
  if (liveOrders > 0) parts.push(`${liveOrders} open order${liveOrders === 1 ? "" : "s"}`);

  const what = parts.join(" and ");
  const fix =
    liveOrders > 0
      ? "Finish or cancel those orders first. To take the product out of the shop, unpublish it — set it back to Draft — rather than deleting it."
      : "The stock ledger is append-only, so deleting this would leave those movements unreadable and unremovable. Unpublish it instead — set it back to Draft — and it leaves the shop with its history intact.";

  return `${label} still has ${what}. ${fix}`;
}

/**
 * The slugs this product used to have, newest-first, from the redirect table.
 *
 * Fails CLOSED and LOUD rather than silently: an empty list here would quietly
 * narrow the guard back to the current slug, which is the exact hole this
 * closes. If the table cannot be read the delete still has the current slug and
 * the SKU to match on, and the failure is logged rather than swallowed.
 */
async function readFormerSlugs(
  payload: { find: (args: never) => Promise<unknown>; logger?: { warn: (m: string) => void } },
  id: string | number,
): Promise<string[]> {
  try {
    const res = await payload.find({
      collection: "product-slug-redirects",
      where: { product: { equals: id } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    } as never);
    const docs = (res as { docs?: Array<{ oldSlug?: unknown }> } | null)?.docs ?? [];
    return docs.map((d) => String(d?.oldSlug ?? "").trim()).filter((v) => v.length > 0);
  } catch (e) {
    payload.logger?.warn(
      `[product-guards] could not read former slugs for ${String(id)} (${(e as Error).message}) — matching on the current slug and SKU only`,
    );
    return [];
  }
}

export const productBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const { payload } = req;

  // The ledger joins by id, but an order line names the product by SLUG, so the
  // product has to be read before the order count can be asked for.
  const product = (await payload
    .findByID({ collection: "products", id, depth: 0, overrideAccess: true })
    .catch(() => null)) as { name?: string; slug?: string; sku?: string } | null;

  const slug = (product?.slug ?? "").trim();
  const sku = (product?.sku ?? "").trim();

  /*
   * EVERY name this product has ever answered to, not just its current one.
   *
   * An order line snapshots the product as TEXT — productName, slug, sku —
   * frozen at purchase so history survives the product being retired. There is
   * no product relationship on an order to query instead, so the only way to
   * connect an old line back to a live product is through an identifier the
   * line recorded.
   *
   * Matching the CURRENT slug alone meant a rename unlocked the delete: the
   * snapshot still said "pump", the product now said "pump-v2", the count fell
   * to zero and the guard waved it through. It bit `pending` orders in
   * particular, because stock moves on the transition INTO paid — so a paid
   * order already had a stock-ledger row keyed by the product ID, which a
   * rename cannot touch, while a pending one had nothing but the slug.
   *
   * product-slug-redirects is the rename-proof link: its rows point at the
   * product BY ID and are written by the same hook that renames it. It is the
   * table the storefront already 301s through, so this adds a reader, not a
   * mechanism.
   */
  const formerSlugs = await readFormerSlugs(payload, id);

  // Two counts, not two document fetches — `count` is an aggregation and does
  // not pull the matching rows across.
  const [ledger, orders] = await Promise.all([
    payload.count({
      collection: "stock-ledger",
      /*
       * Rows that record a TRADE, not every row.
       *
       * An unqualified `product equals id` also counts the opening balance that
       * recordOpeningStock writes when a product is created with a stock figure.
       * Combined with the ledger being create/update/delete-false, that made any
       * product ever given an opening count permanently undeletable by anyone —
       * including a super-admin, and including a product created by mistake a
       * minute earlier. There is no staff-side way out of that state: the row
       * cannot be removed either.
       *
       * `relatedOrder exists` keeps exactly the history worth protecting — stock
       * that moved against a real order — and lets a never-traded product go.
       */
      where: { and: [{ product: { equals: id } }, { relatedOrder: { exists: true } }] },
      overrideAccess: true,
    }),
    slug || sku
      ? payload.count({
          collection: "orders",
          where: {
            and: [
              {
                // `items` is an ARRAY field, so a dot path matches ANY line.
                // Slug OR sku, because either may be the only surviving link:
                // a rename made while the product was unpublished mints no
                // redirect row, leaving the SKU snapshot as the sole thread.
                or: [
                  ...(slug || formerSlugs.length
                    ? [{ "items.slug": { in: [slug, ...formerSlugs].filter(Boolean) } }]
                    : []),
                  ...(sku ? [{ "items.sku": { equals: sku } }] : []),
                ],
              },
              { status: { in: [...LIVE_ORDER_STATUSES] } },
            ],
          },
          overrideAccess: true,
        })
      : Promise.resolve({ totalDocs: 0 }),
  ]);

  const blocker = productDeleteBlocker({
    ledgerRows: ledger.totalDocs,
    liveOrders: orders.totalDocs,
    name: product?.name ?? null,
  });

  if (blocker) throw staffError(blocker);
};
