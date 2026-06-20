import { NextResponse } from "next/server";
import { verifyPaymentSignature, razorpayConfigured } from "@/backend/lib/razorpay";
import {
  findOrderByRazorpayId,
  markOrderPaid,
  markOrderFailed,
} from "@/backend/services/orders.service";
import { sendOrderEmails } from "@/backend/lib/email";
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

  const order = await findOrderByRazorpayId(razorpay_order_id);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  }

  const valid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    razorpaySignature: razorpay_signature,
  });

  if (!valid) {
    // Only a PENDING order can be marked failed — a bad signature must never
    // downgrade an order that was already verified paid.
    if (order.status === "pending") await markOrderFailed(order.id);
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

  // Confirmation emails (best-effort — never block the success response).
  const emailed = await sendOrderEmails({
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
    razorpayPaymentId: razorpay_payment_id,
    address: [order.addressLine1, order.addressLine2, order.city, order.state, order.pincode]
      .filter(Boolean)
      .join(", "),
    displayCurrency: order.displayCurrency,
    usdRateAtPurchase: order.usdRateAtPurchase,
    totalUsdApprox: order.totalUsdApprox,
  }).catch(() => false);

  return NextResponse.json({
    ok: true,
    orderNumber: order.orderNumber,
    saved,
    emailed,
  });
}
