import { NextResponse } from "next/server";
import { verifyWebhookSignature, razorpayWebhookConfigured } from "@/backend/lib/razorpay";
import {
  findOrderByRazorpayId,
  markOrderPaid,
  markOrderFailed,
  markOrderRefunded,
  recordPaymentEvent,
  recordIntegrationLog,
  sendOrderConfirmation,
  getOrderById,
} from "@/backend/services/orders.service";
import { sendOpsAlert } from "@/backend/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/webhook  — Razorpay server-to-server webhook.
 *
 * This is the AUTHORITATIVE source of truth for payment status. The browser-side
 * /api/checkout/verify is a UX fast-path; if the buyer's tab/network dies after a
 * successful capture, this webhook still reconciles the order. Configure it in the
 * Razorpay dashboard (Settings → Webhooks) for events payment.captured / order.paid
 * / payment.failed / refund.processed, with the secret set as RAZORPAY_WEBHOOK_SECRET.
 *
 * Security: the raw body is HMAC-verified against the webhook secret before ANY
 * processing. Idempotent: a duplicate webhook for an already-paid order is a no-op.
 *
 * RETRY CONTRACT (the part that makes this durable): Razorpay redelivers on any
 * non-2xx for ~24h with backoff. We therefore return 5xx whenever WE failed —
 * CMS unreachable on lookup, or the paid-status write failed — and 200 only when
 * the event was truly handled or is genuinely not ours. Answering 200 to a
 * failure would silently strand a captured payment as "pending" forever.
 */
export async function POST(req: Request) {
  if (!razorpayWebhookConfigured()) {
    // Not configured yet — refuse rather than silently accept unverifiable events.
    return NextResponse.json({ ok: false, error: "Webhook not configured." }, { status: 503 });
  }

  // Must read the RAW body for signature verification (do not JSON.parse first).
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string; currency?: string } };
      order?: { entity?: { id?: string; amount?: number } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad payload." }, { status: 400 });
  }

  const type = event.event || "";
  const payment = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;
  const refund = event.payload?.refund?.entity;
  const razorpayOrderId = payment?.order_id || orderEntity?.id;

  // Refunds reference the payment, not our order id — resolve through it below.
  const isRefund = type === "refund.processed";

  // Always 200 on events we can't act on at all, so Razorpay stops retrying.
  if (!razorpayOrderId && !isRefund) return NextResponse.json({ ok: true, ignored: type });

  const lookup = razorpayOrderId
    ? await findOrderByRazorpayId(razorpayOrderId)
    : ({ ok: true, doc: null } as const);

  // CMS unreachable — WE failed, not the event. 503 → Razorpay redelivers.
  if (!lookup.ok) {
    console.error(`[razorpay-webhook] ${type}: CMS lookup failed for ${razorpayOrderId} — asking Razorpay to retry`);
    return NextResponse.json({ ok: false, error: "Order lookup failed — retry." }, { status: 503 });
  }
  const order = lookup.doc;

  const paymentId = payment?.id || refund?.payment_id || "";
  const capturedPaise = Number(payment?.amount ?? orderEntity?.amount ?? 0);

  // Append every signature-verified event to the immutable log (best-effort).
  await recordPaymentEvent({
    eventType: type,
    providerOrderId: razorpayOrderId,
    providerPaymentId: paymentId,
    amount: capturedPaise || refund?.amount || undefined,
    signatureVerified: true,
    order: order?.id,
    idempotencyKey: (isRefund ? refund?.id : paymentId) || `${type}:${razorpayOrderId}`,
    rawPayload: event,
  });

  if (!order && !isRefund) {
    // The CMS answered and genuinely has no such order (e.g. a test event, or an
    // order created outside this site). Ack — retrying can't change the answer —
    // but leave a durable trace for investigation.
    console.warn(`[razorpay-webhook] ${type}: no order for razorpayOrderId ${razorpayOrderId}`);
    await recordIntegrationLog({
      status: "error",
      summary: `${type}: no order found for razorpayOrderId ${razorpayOrderId}`,
      payload: { razorpayOrderId, paymentId },
    });
    return NextResponse.json({ ok: true, ignored: "unknown-order" });
  }

  if (type === "payment.failed" && order) {
    // Re-read fresh: this event can arrive minutes late, AFTER a successful
    // capture was verified — a stale "pending" here must not clobber "paid".
    // (The CMS transition gate also rejects paid→failed as a second line.)
    const fresh = (await getOrderById(order.id)) ?? order;
    if (fresh.status === "pending") await markOrderFailed(order.id);
    return NextResponse.json({ ok: true, handled: "payment.failed" });
  }

  if (isRefund) {
    const target = order ?? null;
    if (!target) {
      // Refund for a payment we can't map — durable trace, human follows up.
      await recordIntegrationLog({
        status: "error",
        summary: `refund.processed: no order found (payment ${paymentId})`,
        payload: { paymentId, refundId: refund?.id, amountPaise: refund?.amount },
      });
      return NextResponse.json({ ok: true, ignored: "refund-unmapped" });
    }
    const done = await markOrderRefunded(target.id);
    await sendOpsAlert(`Refund processed — order ${target.orderNumber}`, [
      `Order: ${target.orderNumber}`,
      `Refund id: ${refund?.id ?? "—"}`,
      `Amount: ₹${((refund?.amount ?? 0) / 100).toFixed(2)}`,
      done ? "Order status set to refunded." : "COULD NOT update the order status — set it manually.",
    ]);
    if (!done) {
      return NextResponse.json({ ok: false, error: "Refund status write failed — retry." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, handled: "refund.processed" });
  }

  if ((type === "payment.captured" || type === "order.paid") && order) {
    // Already reconciled — paid OR anything downstream of it (staff moved it to
    // shipped/delivered). A redelivered payment.captured for such an order must
    // ack, not fall through to the amount-check/markOrderPaid block, which would
    // fail the paid→shipped transition and make Razorpay retry for 24h.
    if (order.status === "paid" || order.status === "shipped" || order.status === "delivered") {
      return NextResponse.json({ ok: true, idempotent: true });
    }
    if (order.status === "cancelled" || order.status === "refunded") {
      // Money arrived for an order already in a terminal state (e.g. the
      // auto-cancel window elapsed before a very late capture). cancelled→paid
      // is an illegal transition by design — a human must refund or reinstate.
      // Retrying wouldn't change anything, so ack — but page ops loudly.
      await recordIntegrationLog({
        status: "error",
        summary: `${type}: payment captured for ${order.status.toUpperCase()} order ${order.orderNumber} — needs manual refund/reinstate`,
        payload: { orderNumber: order.orderNumber, status: order.status, paymentId, capturedPaise },
      });
      await sendOpsAlert(`Payment captured for ${order.status} order ${order.orderNumber}`, [
        `Order: ${order.orderNumber} (status: ${order.status})`,
        `Captured: ₹${(capturedPaise / 100).toFixed(2)} — payment id ${paymentId || "—"}`,
        "The customer HAS been charged after the order reached a terminal state.",
        "Either refund the payment in the Razorpay dashboard, or have Accounts reinstate and fulfil the order.",
      ]);
      return NextResponse.json({ ok: true, flagged: "captured-after-terminal" });
    }
    // Cross-check the captured amount against OUR server-computed total (paise).
    // A capture for the WRONG amount — or an event that omits the amount so we
    // cannot check — must never mark the order paid. Both leave a durable trace
    // and page a human; retrying wouldn't change the payload, so we ack 200.
    const expectedPaise = Math.round(Number(order.total) * 100);
    if (!capturedPaise || !expectedPaise || capturedPaise !== expectedPaise) {
      console.error(
        `[razorpay-webhook] AMOUNT MISMATCH for order ${order.orderNumber}: captured ${capturedPaise || "(missing)"} vs expected ${expectedPaise} — NOT marking paid, needs review.`,
      );
      await recordIntegrationLog({
        status: "error",
        summary: `${type}: amount mismatch on ${order.orderNumber} — captured ${capturedPaise || "(missing)"} vs expected ${expectedPaise} paise; NOT marked paid`,
        payload: { orderNumber: order.orderNumber, capturedPaise, expectedPaise, paymentId },
      });
      await sendOpsAlert(`Payment amount mismatch — order ${order.orderNumber}`, [
        `Order: ${order.orderNumber} (status: ${order.status})`,
        `Captured: ${capturedPaise ? `₹${(capturedPaise / 100).toFixed(2)}` : "amount missing from event"}`,
        `Expected: ₹${(expectedPaise / 100).toFixed(2)}`,
        `Payment id: ${paymentId || "—"}`,
        "The customer HAS been charged. Reconcile in the Razorpay dashboard and update the order manually.",
      ]);
      return NextResponse.json({ ok: true, flagged: "amount-mismatch" });
    }

    const saved = await markOrderPaid(order.id, paymentId);
    if (!saved) {
      // WE failed to persist — 500 so Razorpay redelivers. No email yet: the
      // confirmation must never outrun the recorded truth.
      console.error(`[razorpay-webhook] mark-paid FAILED for ${order.orderNumber} — asking Razorpay to retry`);
      return NextResponse.json({ ok: false, error: "Status write failed — retry." }, { status: 500 });
    }
    // Reconciliation path: if the browser's verify call never ran (tab/network
    // died after capture), this is where the confirmation + GST-invoice email
    // gets sent. Idempotent via emailedAt, so it never duplicates verify's email.
    await sendOrderConfirmation(order, paymentId);
    return NextResponse.json({ ok: true, handled: type });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
