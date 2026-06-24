import type { CollectionBeforeChangeHook, CollectionBeforeDeleteHook } from "payload";
import { hasRole, type Role } from "../access";
import { inboundKeyMatches } from "../lib/internal-key";

/**
 * Order workflow integrity:
 *  - payment states (paid/failed/refunded) may only be set by Accounts/Admin or
 *    the website server (verified Razorpay payment via the internal key);
 *  - fulfilment states (shipped/delivered/cancelled) by Operations/Inventory/+;
 *  - only legal status transitions are allowed (no pending→delivered, refunded→paid);
 *  - the price snapshot (amounts + items) is immutable except for Accounts/Admin;
 *  - paid/fulfilled orders cannot be hard-deleted (cancel instead).
 */

type OrderStatus =
  | "pending" | "paid" | "failed" | "shipped" | "delivered" | "cancelled" | "refunded";

const PAYMENT_STATES = new Set<OrderStatus>(["paid", "failed", "refunded"]);
const FULFILMENT_STATES = new Set<OrderStatus>(["shipped", "delivered", "cancelled"]);

/** Allowed forward transitions (an unchanged status is always fine). */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "failed", "cancelled"],
  failed: ["pending", "cancelled"],
  paid: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

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
  // The website server (already-verified Razorpay payment) may create/transition freely.
  if (isInternalKey(req.headers as Headers | undefined)) return data;

  const user = req.user as { roles?: Role[] } | null | undefined;

  // CREATE: a non-finance staffer must not forge an order already in a payment
  // state (the transition gate below only runs on update).
  if (operation === "create") {
    const to = (data?.status ?? "pending") as OrderStatus;
    if (PAYMENT_STATES.has(to) && !hasRole(user, "super-admin", "admin", "accounts")) {
      throw new Error(`Only Accounts/Admin can create an order in the "${to}" state.`);
    }
    return data;
  }

  if (operation !== "update" || !originalDoc) return data;

  const from = originalDoc.status as OrderStatus;
  const to = (data?.status ?? from) as OrderStatus;

  if (to !== from) {
    if (!(ALLOWED[from] ?? []).includes(to)) {
      throw new Error(`Invalid order status change: "${from}" → "${to}".`);
    }
    if (PAYMENT_STATES.has(to) && !hasRole(user, "super-admin", "admin", "accounts")) {
      throw new Error(`Only Accounts/Admin can move an order to "${to}".`);
    }
    if (
      FULFILMENT_STATES.has(to) &&
      !hasRole(user, "super-admin", "admin", "operations-manager", "inventory", "accounts")
    ) {
      throw new Error(`Only Operations/Inventory/Accounts/Admin can move an order to "${to}".`);
    }
  }

  // Price snapshot is immutable except for Accounts/Admin/Super-admin.
  if (!hasRole(user, "super-admin", "admin", "accounts")) {
    for (const f of AMOUNT_FIELDS) {
      if (data?.[f] !== undefined && JSON.stringify(data[f]) !== JSON.stringify(originalDoc[f])) {
        throw new Error(`You don't have permission to change order ${f}.`);
      }
    }
  }

  return data;
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
