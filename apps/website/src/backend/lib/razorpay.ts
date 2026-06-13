/**
 * Razorpay integration (server-only — uses the secret key).
 *
 * - Orders are created server-side via the Razorpay Orders REST API with the
 *   amount WE computed from CMS prices (never trust client totals).
 * - Payments are confirmed by verifying the HMAC-SHA256 signature Razorpay
 *   returns to the browser — the only proof a payment is genuine.
 *
 * Env (apps/website/.env.local):
 *   RAZORPAY_KEY_ID=rzp_test_xxxx   (test mode) / rzp_live_xxxx (production)
 *   RAZORPAY_KEY_SECRET=xxxx
 */
import crypto from "crypto";

const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";

export const razorpayConfigured = (): boolean => Boolean(KEY_ID && KEY_SECRET);

/** Public key id — safe to send to the browser (needed by checkout.js). */
export const razorpayKeyId = (): string => KEY_ID;

export type RazorpayOrder = {
  id: string;
  amount: number; // paise
  currency: string;
  receipt?: string;
  status: string;
};

/**
 * Create a Razorpay Order. `amountInr` is in rupees (GST-inclusive);
 * Razorpay wants paise. Throws on API failure.
 */
export async function createRazorpayOrder(opts: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(opts.amountInr * 100),
      currency: "INR",
      receipt: opts.receipt,
      notes: opts.notes ?? {},
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Razorpay order create failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/**
 * Verify the payment signature returned to the browser after a successful
 * payment. Constant-time comparison; returns false on any malformed input.
 */
export function verifyPaymentSignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!KEY_SECRET || !opts.razorpayOrderId || !opts.razorpayPaymentId || !opts.razorpaySignature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(`${opts.razorpayOrderId}|${opts.razorpayPaymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(opts.razorpaySignature, "hex")
    );
  } catch {
    return false; // malformed hex / length mismatch
  }
}
