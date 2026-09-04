import type { CollectionAfterChangeHook } from "payload";
import { recordStockMovement } from "../lib/stock";
import { stockMovementForTransition } from "../lib/stock-math";

/**
 * Stock follows the order.
 *
 * Until this hook existed nothing in either application ever moved inventory: a
 * paid order decremented nothing, a cancellation restored nothing, and
 * `stock-ledger` — a correct append-only ledger — had no writer at all. The shop
 * could oversell without limit and leave no trace of having done so.
 *
 * Two transitions matter:
 *   → paid                        take the goods out of stock
 *   paid/shipped/delivered → cancelled | refunded    put them back
 *
 * IDEMPOTENCY. Razorpay redelivers webhooks, and staff re-save orders. The
 * ledger is itself the record of whether stock has already been applied, so the
 * guard needs no new field: before moving anything, look for a movement of the
 * same kind already booked against this order. That is exact, survives restarts,
 * and cannot drift from the thing it is protecting.
 *
 * THIS HOOK NEVER THROWS. An order must not fail to be marked paid because
 * inventory bookkeeping had a problem — the payment is the fact, the stock
 * number is the bookkeeping. Failures are logged loudly instead, the same way
 * the audit hook treats a failed audit write.
 */

type OrderItem = {
  slug?: string | null;
  sku?: string | null;
  productName?: string | null;
  qty?: number | null;
};

type OrderDoc = {
  id?: string | number;
  status?: string | null;
  orderNumber?: string | null;
  items?: OrderItem[] | null;
};

/** Has a movement of this kind already been booked against this order? */
async function alreadyApplied(
  payload: { find: (args: never) => Promise<{ totalDocs: number }> },
  orderId: string,
  movementType: "stock-out" | "returned"
): Promise<boolean> {
  const res = await payload.find({
    collection: "stock-ledger",
    where: { and: [{ relatedOrder: { equals: orderId } }, { movementType: { equals: movementType } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as never);
  return res.totalDocs > 0;
}

export const orderStockAfterChange: CollectionAfterChangeHook = async ({
  req,
  doc,
  previousDoc,
  operation,
}) => {
  const payload = req.payload;
  const order = doc as OrderDoc;
  const before = (previousDoc ?? {}) as OrderDoc;

  try {
    const from = String(before.status ?? "");
    const to = String(order.status ?? "");
    // A create can arrive already paid (staff entering a phone order); an update
    // only matters when the status actually moved.
    if (operation === "update" && from === to) return doc;

    const movementType = stockMovementForTransition(from, to);
    if (!movementType) return doc;

    const orderId = String(order.id ?? "");
    if (!orderId) return doc;

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return doc;

    if (await alreadyApplied(payload as never, orderId, movementType)) {
      payload.logger.info(
        { orderNumber: order.orderNumber, movementType },
        "[stock] already applied for this order — skipping",
      );
      return doc;
    }

    const reason =
      movementType === "stock-out"
        ? `Order ${order.orderNumber ?? orderId} ${to}`
        : `Order ${order.orderNumber ?? orderId} ${to} — stock returned`;

    for (const item of items) {
      const qty = Number(item?.qty);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const slug = (item?.slug ?? "").trim();
      if (!slug) {
        payload.logger.warn(
          { orderNumber: order.orderNumber, productName: item?.productName },
          "[stock] order line has no product slug — cannot move stock",
        );
        continue;
      }

      // Line items snapshot the product by slug rather than holding a
      // relationship, so resolve it. One lookup per line, and an order has a
      // handful of lines — this is not an N+1 across a list.
      const found = await payload.find({
        collection: "products",
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      } as never);
      const product = found?.docs?.[0] as { id?: string | number } | undefined;
      if (!product?.id) {
        payload.logger.warn(
          { orderNumber: order.orderNumber, slug },
          "[stock] product not found for order line — stock not moved",
        );
        continue;
      }

      const result = await recordStockMovement(
        payload,
        {
          productId: String(product.id),
          movementType,
          quantity: qty,
          reason,
          relatedOrder: orderId,
          ...(req.user?.id ? { userId: String(req.user.id) } : {}),
        },
        req,
      );

      if (!result.ok) {
        // Refusing is the correct outcome for an oversell — the order still
        // stands, but somebody has to reconcile the shelf. Make that loud.
        payload.logger.error(
          { orderNumber: order.orderNumber, slug, qty, movementType, reason: result.error },
          "[stock] movement refused for order line — inventory needs reconciling",
        );
      }
    }
  } catch (err) {
    payload.logger.error(
      { err, orderNumber: (doc as OrderDoc)?.orderNumber },
      "[stock] failed to apply stock movements for order",
    );
  }

  return doc;
};
