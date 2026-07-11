import type { CollectionAfterChangeHook } from "payload";
import { outboundKey } from "../lib/internal-key";

/**
 * Keep the customer in the loop when a shipment moves:
 *  - status → dispatched: the linked order becomes "shipped", and the website is
 *    pinged to send the tracking email (the website owns Resend — same pattern
 *    as ticket-notify.ts). Fire-and-forget; a mail failure never blocks saving.
 *  - status → delivered: the linked order becomes "delivered".
 *
 * The order update runs as the STAFF USER who edited the shipment (req passed
 * through), so the order-workflow transition/role gates still apply — an unpaid
 * order legitimately refuses to become "shipped" (pending→shipped is illegal),
 * in which case we log and leave the shipment saved.
 */
const WEBSITE = process.env.WEBSITE_URL || "http://localhost:3000";
const KEY = outboundKey("CMS_SHIP_NOTIFY_KEY");

const ORDER_STATUS_FOR: Record<string, "shipped" | "delivered"> = {
  dispatched: "shipped",
  delivered: "delivered",
};

export const syncOrderOnShipment: CollectionAfterChangeHook = async ({ doc, previousDoc, req, operation }) => {
  try {
    const status = String(doc?.status ?? "");
    const before = String(previousDoc?.status ?? "");
    // Only act on a real transition (or a create that lands directly in one).
    if (status === before && operation !== "create") return doc;
    const target = ORDER_STATUS_FOR[status];
    if (!target) return doc;

    const orderId = typeof doc.order === "object" && doc.order ? doc.order.id : doc.order;
    if (!orderId) return doc;

    const order = await req.payload
      .findByID({ collection: "orders", id: orderId, depth: 0, overrideAccess: true })
      .catch(() => null);
    if (!order) return doc;

    // Advance the order (idempotent: skip if already there or beyond).
    if (order.status !== target) {
      try {
        await req.payload.update({
          collection: "orders",
          id: orderId,
          data: { status: target },
          req, // staff context → workflow role gates still enforced
          overrideAccess: true,
        });
      } catch (e) {
        req.payload.logger.warn(
          `[shipment-sync] could not move order ${order.orderNumber} to "${target}": ${(e as Error).message}`,
        );
        // An illegal transition (e.g. unpaid order) shouldn't email tracking either.
        return doc;
      }
    }

    // Tracking email — only on dispatch, and only when we can reach the website.
    if (status === "dispatched" && KEY && order.email) {
      void fetch(`${WEBSITE}/api/orders/notify-shipped`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": KEY },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          name: order.name,
          email: order.email,
          carrier: doc.carrier,
          trackingNumber: doc.trackingNumber,
          trackingUrl: doc.trackingUrl,
          items: Array.isArray(doc.items)
            ? doc.items.map((it: { productName?: string; qty?: number }) => ({
                productName: it.productName,
                qty: it.qty,
              }))
            : undefined,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {
        /* website down — the shipment is saved; tracking still shows in the account */
      });
    }
  } catch (e) {
    req.payload.logger.error(`[shipment-sync] ${(e as Error).message}`);
  }
  return doc;
};
