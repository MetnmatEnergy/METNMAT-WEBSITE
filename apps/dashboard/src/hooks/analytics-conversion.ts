import type { CollectionAfterChangeHook } from "payload";

/**
 * Server-truth purchase attribution: when an order first enters a PAID state,
 * stamp the linked analytics session (by the collector sid captured at create)
 * with the AUTHORITATIVE conversion — convertedPurchase + the order number and
 * the order's own total. This is what makes revenue-by-source honest: it counts
 * orders paid via UPI/redirect that never returned to the browser (so the
 * client-side `purchase` beacon never fired), and it can't be forged from the
 * public collect endpoint because the number comes from the Order, not the client.
 *
 * Strictly ADDITIVE and FAIL-SAFE: it never throws (a failed analytics write must
 * never block or roll back an order save) and touches only analytics-sessions.
 */

const PAID = new Set(["paid", "shipped", "delivered"]);

type OrderDoc = { status?: string; analyticsSid?: string; orderNumber?: string; total?: number };

export const linkAnalyticsConversion: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  try {
    const d = doc as OrderDoc;
    const prev = previousDoc as OrderDoc | undefined;
    const sid = typeof d.analyticsSid === "string" ? d.analyticsSid : "";
    // Only on the FIRST transition into a paid state, and only if we have a sid
    // to link. Guarding on the transition keeps this to one write per order.
    if (!sid || !d.status || !PAID.has(d.status) || (prev?.status && PAID.has(prev.status))) return;

    const sessions = (req.payload.db as unknown as {
      collections: Record<string, { findOneAndUpdate?: (q: unknown, u: unknown, o?: unknown) => Promise<unknown> }>;
    }).collections["analytics-sessions"];
    if (!sessions?.findOneAndUpdate) return;

    // Update the EXISTING session only (upsert: false — a session must have been
    // created by real traffic; we never invent one from an order).
    await sessions.findOneAndUpdate(
      { sid },
      {
        $set: {
          convertedPurchase: true,
          orderNumber: String(d.orderNumber ?? "").slice(0, 40),
          purchaseTotal: Number(d.total) || 0,
          updatedAt: new Date(),
        },
      },
      { upsert: false }
    );
  } catch (e) {
    req.payload.logger?.warn?.(`[analytics] order→session link failed: ${(e as Error)?.message ?? e}`);
  }
};
