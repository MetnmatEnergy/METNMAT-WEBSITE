import { NextResponse } from "next/server";
import { verifyWebhookSignature, razorpayWebhookConfigured } from "@/backend/lib/razorpay";
import {
  findOrderByRazorpayId,
  markOrderPaid,
  markOrderFailed,
  recordPaymentEvent,
  sendOrderConfirmation,
} from "@/backend/services/orders.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkout/webhook  — Razorpay server-to-server webhook.
 *
 * This is the AUTHORITATIVE source of truth for payment status. The browser-side
 * /api/checkout/verify is a UX fast-path; if the buyer's tab/network dies after a
 * successful capture, this webhook still reconciles the order. Configure it in the
 * Razorpay dashboard (Settings → Webhooks) for events payment.captured / order.paid
 * / payment.failed, with the secret set as RAZORPAY_WEBHOOK_SECRET.
 *
 * Security: the raw body is HMAC-verified against the webhook secret before ANY
 * processing. Idempotent: a duplicate webhook for an already-paid order is a no-op.
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
  const razorpayOrderId = payment?.order_id || orderEntity?.id;

  // Always 200 on events we don't act on, so Razorpay stops retrying.
  if (!razorpayOrderId) return NextResponse.json({ ok: true, ignored: type });

  const order = await findOrderByRazorpayId(razorpayOrderId);
  const paymentId = payment?.id || "";
  const capturedPaise = Number(payment?.amount ?? orderEntity?.amount ?? 0);

  // Append every signature-verified event to the immutable log (best-effort).
  await recordPaymentEvent({
    eventType: type,
    providerOrderId: razorpayOrderId,
    providerPaymentId: paymentId,
    amount: capturedPaise || undefined,
    signatureVerified: true,
    order: order?.id,
    idempotencyKey: paymentId || `${type}:${razorpayOrderId}`,
    rawPayload: event,
  });

  if (!order) {
    // Unknown order — ack so Razorpay doesn't hammer us; log for investigation.
    console.warn(`[razorpay-webhook] ${type}: no order for razorpayOrderId ${razorpayOrderId}`);
    return NextResponse.json({ ok: true, ignored: "unknown-order" });
  }

  if (type === "payment.failed") {
    if (order.status === "pending") await markOrderFailed(order.id);
    return NextResponse.json({ ok: true, handled: "payment.failed" });
  }

  if (type === "payment.captured" || type === "order.paid") {
    if (order.status === "paid") {
      return NextResponse.json({ ok: true, idempotent: true }); // already reconciled
    }
    // Cross-check the captured amount against OUR server-computed total (paise).
    const expectedPaise = Math.round(Number(order.total) * 100);
    if (capturedPaise && expectedPaise && capturedPaise !== expectedPaise) {
      console.error(
        `[razorpay-webhook] AMOUNT MISMATCH for order ${order.orderNumber}: captured ${capturedPaise} vs expected ${expectedPaise} — NOT marking paid, needs review.`,
      );
      return NextResponse.json({ ok: true, flagged: "amount-mismatch" });
    }
    const ok = await markOrderPaid(order.id, paymentId);
    // Reconciliation path: if the browser's verify call never ran (tab/network
    // died after capture), this is where the confirmation + GST-invoice email
    // gets sent. Idempotent via emailedAt, so it never duplicates verify's email.
    await sendOrderConfirmation(order, paymentId);
    return NextResponse.json({ ok, handled: type });
  }

  return NextResponse.json({ ok: true, ignored: type });
}
