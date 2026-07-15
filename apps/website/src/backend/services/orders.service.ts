/**
 * Orders service — persists checkout orders into the dashboard CMS (Payload
 * `orders` collection). All writes use the shared x-internal-key header, so
 * only the website SERVER can create/update orders (never the public).
 * Staff see and manage them in the admin under Sales → Orders.
 */
import { outboundKey } from "@/backend/lib/internal-key";
import { sendOrderEmails } from "@/backend/lib/email";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const INTERNAL_KEY = outboundKey("CMS_ORDER_WRITE_KEY");

export type OrderItemInput = {
  productName: string;
  slug: string;
  sku?: string;
  size?: string;
  qty: number;
  unitPrice: number; // incl. GST, ₹
  lineTotal: number; // incl. GST, ₹
  /** HSN/SAC code snapshotted at purchase — rendered on the GST invoice. */
  hsnSac?: string;
  countryOfOrigin?: string;
};

export type OrderInput = {
  orderNumber: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  gstin?: string;
  businessName?: string;
  /** Billing address. When billingSameAsShipping is true these mirror shipping. */
  billingSameAsShipping?: boolean;
  billingName?: string;
  billingLine1?: string;
  billingLine2?: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  billingCountry?: string;
  /** Customer-provided delivery instructions (distinct from internal notes). */
  deliveryNotes?: string;
  /** Customer opted in to marketing emails at checkout. */
  marketingOptIn?: boolean;
  items: OrderItemInput[];
  subtotal: number;
  gstAmount: number;
  total: number;
  razorpayOrderId: string;
  /** Linked storefront customer account id, if the buyer was logged in. */
  customer?: string;
  /** Currency the customer browsed in (display context; charge is always INR). */
  displayCurrency?: "INR" | "USD";
  usdRateAtPurchase?: number;
  totalUsdApprox?: number;
  /** First-party analytics session id (mm-sid) — links the paid order back to
   *  the session for server-truth conversion attribution. Optional/internal. */
  analyticsSid?: string;
};

export type OrderDoc = OrderInput & {
  id: string;
  status: string;
  razorpayPaymentId?: string;
  /** Set once the confirmation email has been sent (idempotency guard). */
  emailedAt?: string;
};

const headers = {
  "Content-Type": "application/json",
  "x-internal-key": INTERNAL_KEY,
};

/** Create a pending order. Returns the created doc or null. */
export async function createOrder(input: OrderInput): Promise<OrderDoc | null> {
  try {
    const res = await fetch(`${CMS}/api/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...input, status: "pending" }),
    });
    if (!res.ok) {
      console.error(`[orders] create failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const json = (await res.json()) as { doc?: OrderDoc };
    return json?.doc ?? null;
  } catch (e) {
    console.error("[orders] create error:", e);
    return null;
  }
}

/**
 * Result of an order lookup that must distinguish "the CMS answered: no such
 * order" from "the CMS was unreachable". The webhook depends on this: a
 * transient outage must produce a retryable 5xx, never a swallowed 200 —
 * otherwise Razorpay stops redelivering and a captured payment is lost to a
 * cold start.
 */
export type OrderLookup = { ok: true; doc: OrderDoc | null } | { ok: false };

/** Find an order by its Razorpay order id (for payment verification). */
export async function findOrderByRazorpayId(razorpayOrderId: string): Promise<OrderLookup> {
  try {
    const res = await fetch(
      `${CMS}/api/orders?limit=1&where[razorpayOrderId][equals]=${encodeURIComponent(razorpayOrderId)}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) {
      console.error(`[orders] lookup by razorpayOrderId failed (${res.status})`);
      return { ok: false };
    }
    const json = (await res.json()) as { docs?: OrderDoc[] };
    return { ok: true, doc: json?.docs?.[0] ?? null };
  } catch (e) {
    console.error("[orders] lookup by razorpayOrderId error:", e);
    return { ok: false };
  }
}

/** Re-read a single order (fresh doc — used to close the email-dedup race). */
export async function getOrderById(id: string): Promise<OrderDoc | null> {
  try {
    const res = await fetch(`${CMS}/api/orders/${id}?depth=0`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as OrderDoc) ?? null;
  } catch {
    return null;
  }
}

/** Mark an order paid (after server-side signature verification). */
export async function markOrderPaid(
  id: string,
  razorpayPaymentId: string
): Promise<boolean> {
  try {
    const res = await fetch(`${CMS}/api/orders/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "paid",
        razorpayPaymentId,
        paidAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      console.error(`[orders] mark-paid failed (${res.status})`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[orders] mark-paid error:", e);
    return false;
  }
}

/** Mark an order failed (payment abandoned or verification failed). */
export async function markOrderFailed(id: string): Promise<void> {
  try {
    await fetch(`${CMS}/api/orders/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "failed" }),
    });
  } catch {
    /* best effort */
  }
}

/** Mark an order refunded (driven by a signature-verified refund webhook). */
export async function markOrderRefunded(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${CMS}/api/orders/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "refunded" }),
    });
    if (!res.ok) console.error(`[orders] mark-refunded failed (${res.status})`);
    return res.ok;
  } catch (e) {
    console.error("[orders] mark-refunded error:", e);
    return false;
  }
}

/** Stamp the confirmation email as sent, so it's never re-sent. */
async function markOrderEmailed(id: string): Promise<void> {
  try {
    await fetch(`${CMS}/api/orders/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ emailedAt: new Date().toISOString() }),
    });
  } catch {
    /* best effort */
  }
}

/**
 * Send the order confirmation (+ internal copy) exactly once. BOTH the browser
 * verify path and the server webhook call this; the `emailedAt` flag — set after
 * a successful send — stops a duplicate if both fire. Critically this means a
 * buyer whose tab/network dies after capture still gets their confirmation +
 * GST-invoice email from the webhook. Best-effort; never throws.
 */
export async function sendOrderConfirmation(order: OrderDoc, paymentId: string): Promise<boolean> {
  if (order.emailedAt) return false; // already sent
  // The caller's doc may be stale (fetched before another path emailed). Re-read
  // right before sending — verify and the webhook typically race seconds apart,
  // so this closes almost the whole duplicate-email window.
  const fresh = order.id ? await getOrderById(order.id) : null;
  if (fresh?.emailedAt) return false;
  const ok = await sendOrderEmails({
    orderNumber: order.orderNumber,
    name: order.name,
    email: order.email,
    phone: order.phone,
    items: order.items.map((it) => ({
      productName: it.productName,
      qty: it.qty,
      lineTotal: it.lineTotal,
    })),
    subtotal: order.subtotal,
    gstAmount: order.gstAmount,
    total: order.total,
    razorpayPaymentId: paymentId,
    // Country included — the same line goes to the fulfilment team's copy, and an
    // international order without it reads as a domestic one.
    address: [order.addressLine1, order.addressLine2, order.city, order.state, order.pincode, order.country]
      .filter(Boolean)
      .join(", "),
    displayCurrency: order.displayCurrency,
    usdRateAtPurchase: order.usdRateAtPurchase,
    totalUsdApprox: order.totalUsdApprox,
  }).catch(() => false);
  if (ok && order.id) await markOrderEmailed(order.id);
  return ok;
}

/**
 * Durable operations trace for payment anomalies (amount mismatch, stuck
 * unpaid, refunds) — lands in the dashboard's IntegrationLogs where staff look,
 * instead of dying in Cloud Run stdout. Best-effort. Uses the SHARED internal
 * key: integration-logs accepts INTERNAL_API_KEY, not the order-scoped key.
 */
export async function recordIntegrationLog(input: {
  status: "success" | "error";
  summary: string;
  error?: string;
  payload?: unknown;
}): Promise<void> {
  try {
    const res = await fetch(`${CMS}/api/integration-logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": outboundKey("CMS_LOGS_KEY"),
      },
      body: JSON.stringify({ integration: "razorpay-webhook", ...input }),
    });
    if (!res.ok) {
      console.error(
        `[integration-logs] record REFUSED (${res.status}): ${(await res.text().catch(() => "")).slice(0, 200)}`
      );
    }
  } catch (e) {
    console.error("[integration-logs] record error:", e);
  }
}

/** Append a payment gateway event to the immutable PaymentEvents log (best-effort). */
export async function recordPaymentEvent(input: {
  eventType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  amount?: number;
  signatureVerified?: boolean;
  order?: string;
  idempotencyKey?: string;
  rawPayload?: unknown;
}): Promise<void> {
  try {
    await fetch(`${CMS}/api/payment-events`, {
      method: "POST",
      headers,
      body: JSON.stringify({ provider: "razorpay", currency: "INR", ...input }),
    });
  } catch (e) {
    console.error("[payment-events] record error:", e);
  }
}
