import { NextResponse } from "next/server";
import { verifyPaymentSignature, razorpayConfigured } from "@/backend/lib/razorpay";
import {
  findOrderByRazorpayId,
  markOrderPaid,
  sendOrderConfirmation,
} from "@/backend/services/orders.service";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

/**
 * POST /api/checkout/verify
 * Called by the browser after Razorpay reports success. The HMAC signature is
 * the cryptographic proof the payment is genuine — only a verified signature
 * marks the order paid and triggers confirmation emails.
 */

type Body = {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

export async function POST(req: Request) {
  const rl = await limitRate(`verify:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  if (!razorpayConfigured()) {
    return NextResponse.json({ ok: false, error: "Payments not configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json({ ok: false, error: "Missing payment details." }, { status: 400 });
  }

  const lookup = await findOrderByRazorpayId(razorpay_order_id);
  if (!lookup.ok) {
    // CMS hiccup — the payment may well be genuine; don't tell the buyer their
    // order doesn't exist. The webhook is the authoritative backstop.
    return NextResponse.json(
      { ok: false, error: "We couldn't confirm your order right now — if you were charged, it will be confirmed automatically within a few minutes." },
      { status: 503 }
    );
  }
  const order = lookup.doc;
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const valid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  if (!valid) {
    // Do NOT mutate order state here: this endpoint is unauthenticated, so
    // anyone who learns a pending razorpay_order_id could forge a bad signature
    // and flip the order to failed before the buyer pays (griefing — audit
    // finding). Genuine failures are recorded by the signed Razorpay webhook
    // (payment.failed) and stale pending orders by the lazy sweep in
    // customer.ts (sweepStaleUnpaid); a forged request here changes nothing.
    console.warn(`[checkout] INVALID signature for order ${order.orderNumber}`);
    return NextResponse.json(
      { ok: false, error: "Payment verification failed. If you were charged, contact us with your payment ID." },
      { status: 400 }
    );
  }

  // Valid signature + already paid → idempotent success (double-submit, retry).
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, orderNumber: order.orderNumber, saved: true });
  }

  const saved = await markOrderPaid(order.id, razorpay_payment_id);

  // Confirmation emails only once the paid status is actually recorded — the
  // email must never outrun the stored truth. If the write failed, the webhook
  // (which retries on 5xx) will mark it paid and send the email instead.
  const emailed = saved ? await sendOrderConfirmation(order, razorpay_payment_id) : false;

  return NextResponse.json({
    ok: true,
    orderNumber: order.orderNumber,
    saved,
    emailed,
  });
}
