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

/** Find an order by its Razorpay order id (for payment verification). */
export async function findOrderByRazorpayId(razorpayOrderId: string): Promise<OrderDoc | null> {
  try {
    const res = await fetch(
      `${CMS}/api/orders?limit=1&where[razorpayOrderId][equals]=${encodeURIComponent(razorpayOrderId)}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { docs?: OrderDoc[] };
    return json?.docs?.[0] ?? null;
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
    address: [order.addressLine1, order.addressLine2, order.city, order.state, order.pincode]
      .filter(Boolean)
      .join(", "),
    displayCurrency: order.displayCurrency,
    usdRateAtPurchase: order.usdRateAtPurchase,
    totalUsdApprox: order.totalUsdApprox,
  }).catch(() => false);
  if (ok && order.id) await markOrderEmailed(order.id);
  return ok;
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
