import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook } from "payload";
import { hasRoleOrArea, type Role } from "../access";
import { inboundKeyMatches } from "../lib/internal-key";
import { bumpCounter, countersModel, istYear2 } from "./customer-code";

/**
 * Order workflow integrity:
 *  - payment states (paid/failed/refunded) may only be set by Accounts/Admin or
 *    the website server (verified Razorpay payment via the internal key);
 *  - fulfilment states (shipped/delivered/cancelled) by Operations/Inventory/+;
 *  - only legal status transitions are allowed — for EVERYONE, including the
 *    internal key (a delayed payment.failed webhook must never clobber "paid");
 *  - a sequential GST invoice number is minted the moment an order first turns
 *    paid (atomic per-financial-year counter), then immutable;
 *  - the price snapshot (amounts + items) is immutable except for Accounts/Admin;
 *  - paid/fulfilled orders cannot be hard-deleted (cancel instead).
 */

type OrderStatus =
  | "pending" | "paid" | "failed" | "shipped" | "delivered" | "cancelled" | "refunded";

const PAYMENT_STATES = new Set<OrderStatus>(["paid", "failed", "refunded"]);
const FULFILMENT_STATES = new Set<OrderStatus>(["shipped", "delivered", "cancelled"]);

/**
 * Allowed forward transitions (an unchanged status is always fine).
 * failed→paid is legal: a first payment attempt can fail and a later attempt on
 * the same Razorpay order capture — the webhook then rightly marks it paid.
 */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "failed", "cancelled"],
  failed: ["pending", "paid", "cancelled"],
  paid: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

// ── Sequential GST invoice numbers ───────────────────────────────────────────
// GST Rule 46 wants a consecutive serial unique within the financial year (and
// ≤16 chars). The random order number doesn't qualify; this counter does.
// Indian FY runs April→March, so an IST date in Jan–Mar belongs to the PREVIOUS
// year's series: FY 2025-26 → "INV-2526-000042" (15 chars).

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Financial-year label for an instant, in IST — e.g. 2026-07-11 → "2627". */
export function fyLabel(at: Date = new Date()): string {
  const ist = new Date(at.getTime() + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const startYear = ist.getUTCMonth() + 1 >= 4 ? y : y - 1;
  return `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
}

export function formatInvoiceNumber(fy: string, seq: number): string {
  return `INV-${fy}-${String(seq).padStart(6, "0")}`;
}

const AMOUNT_FIELDS = ["subtotal", "gstAmount", "total", "items"] as const;
const UNDELETABLE = new Set<OrderStatus>(["paid", "shipped", "delivered", "refunded"]);

function isInternalKey(headers: Headers | undefined): boolean {
  return inboundKeyMatches(headers?.get?.("x-internal-key"), "CMS_ORDER_WRITE_KEY");
}

export const orderBeforeChange: CollectionBeforeChangeHook = async ({
  req,
  operation,
  data,
  originalDoc,
}) => {
  const internal = isInternalKey(req.headers as Headers | undefined);
  const user = req.user as { roles?: Role[] } | null | undefined;
  const d = (data ?? {}) as Record<string, unknown>;

  /**
   * Stamp the moment a status is ENTERED (failed/cancelled/refunded) — these
   * drive the customer's tracking timeline, so they must be set centrally no
   * matter who transitions the order (webhook, auto-cancel sweep, or staff).
   */
  const stampTransition = (from: OrderStatus | undefined, to: OrderStatus) => {
    if (to === from) return;
    const now = new Date().toISOString();
    if (to === "failed") d.failedAt = now;
    if (to === "cancelled") d.cancelledAt = now;
    if (to === "refunded") d.refundedAt = now;
  };

  /** First transition into "paid" mints the immutable sequential invoice number. */
  const mintInvoiceIfNeeded = async (from: OrderStatus | undefined, to: OrderStatus) => {
    const existing = (originalDoc as { invoiceNumber?: string } | undefined)?.invoiceNumber;
    if (existing) {
      // Immutable once assigned — force any incoming value back (like userCode).
      d.invoiceNumber = existing;
      return;
    }
    if (to === "paid" && from !== "paid") {
      const fy = fyLabel();
      const seq = await bumpCounter(countersModel(req.payload.db), `order-invoice-${fy}`);
      d.invoiceNumber = formatInvoiceNumber(fy, seq);
      d.invoiceDate = new Date().toISOString();
    } else {
      // Never allow an invoice number to be set by hand.
      delete d.invoiceNumber;
    }
  };

  // CREATE
  if (operation === "create") {
    const to = (d.status ?? "pending") as OrderStatus;
    // A non-finance staffer must not forge an order already in a payment state.
    if (!internal && PAYMENT_STATES.has(to) && !hasRoleOrArea(user, ["super-admin", "admin", "accounts"], ["accounts"])) {
      throw new Error(`Only Accounts/Admin can create an order in the "${to}" state.`);
    }
    stampTransition(undefined, to);
    await mintInvoiceIfNeeded(undefined, to);
    return d;
  }

  if (operation !== "update" || !originalDoc) return d;

  const from = originalDoc.status as OrderStatus;
  const to = (d.status ?? from) as OrderStatus;

  if (to !== from) {
    // Transition LEGALITY binds everyone — including the website's internal key.
    // Concretely: a payment.failed webhook delivered minutes late must not take
    // a "paid" order back to "failed" (paid→failed is not a legal move).
    if (!(ALLOWED[from] ?? []).includes(to)) {
      throw new Error(`Invalid order status change: "${from}" → "${to}".`);
    }
    // Role gates apply to staff only — the internal key is a verified-payment
    // signal from the website server, not a person.
    if (!internal) {
      if (PAYMENT_STATES.has(to) && !hasRoleOrArea(user, ["super-admin", "admin", "accounts"], ["accounts"])) {
        throw new Error(`Only Accounts/Admin can move an order to "${to}".`);
      }
      if (
        FULFILMENT_STATES.has(to) &&
        !hasRoleOrArea(
          user,
          ["super-admin", "admin", "operations-manager", "inventory", "accounts"],
          ["operations", "accounts"],
        )
      ) {
        throw new Error(`Only Operations/Inventory/Accounts/Admin can move an order to "${to}".`);
      }
    }
  }

  stampTransition(from, to);
  await mintInvoiceIfNeeded(from, to);

  // Price snapshot is immutable except for Accounts/Admin/Super-admin (the
  // website server never rewrites amounts after create either).
  if (!internal && !hasRoleOrArea(user, ["super-admin", "admin", "accounts"], ["accounts"])) {
    for (const f of AMOUNT_FIELDS) {
      if (d?.[f] !== undefined && JSON.stringify(d[f]) !== JSON.stringify(originalDoc[f])) {
        throw new Error(`You don't have permission to change order ${f}.`);
      }
    }
  }

  return d;
};

export const orderBeforeDelete: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const order = await req.payload.findByID({
    collection: "orders",
    id,
    depth: 0,
    overrideAccess: true,
  });
  const status = (order as { status?: OrderStatus })?.status;
  if (status && UNDELETABLE.has(status)) {
    throw new Error(
      `This order is "${status}" — paid/fulfilled orders cannot be deleted (use the "cancelled" status instead).`,
    );
  }
};
