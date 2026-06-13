import { NextResponse } from "next/server";
import { getProductBySlug, getUsdRate } from "@/frontend/lib/cms";
import { unitPriceForQty, inclGST, gstPortionOf } from "@/frontend/lib/catalog";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from "@/backend/lib/razorpay";
import { createOrder, type OrderItemInput } from "@/backend/services/orders.service";
import { getCurrentCustomer } from "@/backend/lib/customer";

/**
 * POST /api/checkout/create-order
 * Creates a Razorpay order + a pending order record in the dashboard CMS.
 *
 * SECURITY: the client only sends item slugs + quantities and the shipping
 * details. All prices are recomputed HERE from the CMS catalog (tier breaks +
 * GST), so a tampered client can never change what gets charged.
 */

type Body = {
  customer?: { name?: string; email?: string; phone?: string; company?: string };
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  gstin?: string;
  businessName?: string;
  items?: { slug?: string; qty?: number }[];
  /** Display context only — never used for amounts. */
  displayCurrency?: string;
};

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!razorpayConfigured()) {
    return bad(
      "Online payment is not configured yet. Please use 'Request a quote' or contact us to order.",
      503
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Invalid request body.");
  }

  const name = body.customer?.name?.trim();
  const email = body.customer?.email?.trim();
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return bad("Please provide your name and a valid email.");
  }
  const items = (body.items ?? []).filter(
    (i) => typeof i.slug === "string" && i.slug && Number.isFinite(i.qty) && (i.qty as number) > 0
  );
  if (!items.length) return bad("Your cart is empty.");
  if (items.length > 50) return bad("Too many items in one order.");

  // Recompute every price from the CMS (GST-inclusive, tier-aware).
  const orderItems: OrderItemInput[] = [];
  for (const i of items) {
    const product = await getProductBySlug(i.slug as string);
    if (!product) return bad(`Product not found: ${i.slug}`);
    if (!product.price) {
      return bad(`"${product.name}" is quote-only — please request a quote for it.`);
    }
    const qty = Math.min(Math.max(Math.round(i.qty as number), product.moq || 1), 10_000);
    const unitIncl = inclGST(unitPriceForQty(product, qty));
    orderItems.push({
      productName: product.name,
      slug: product.slug,
      sku: product.sku,
      qty,
      unitPrice: unitIncl,
      lineTotal: unitIncl * qty,
    });
  }
  const subtotal = orderItems.reduce((n, it) => n + it.lineTotal, 0);
  const gstAmount = gstPortionOf(subtotal);
  const total = subtotal; // shipping arranged separately for B2B lab equipment

  // Capture what the customer saw (display context — the charge stays INR).
  const displayCurrency: "INR" | "USD" = body.displayCurrency === "USD" ? "USD" : "INR";
  const usdRate = await getUsdRate();
  const totalUsdApprox =
    displayCurrency === "USD" ? Math.round((total / usdRate) * 100) / 100 : undefined;

  // Human-friendly order number: MM-YYYYMMDD-XXXX
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const orderNumber = `MM-${ymd}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  // 1) Razorpay order (source of truth for the charge).
  let rzp;
  try {
    rzp = await createRazorpayOrder({
      amountInr: total,
      receipt: orderNumber,
      notes: { orderNumber, email },
    });
  } catch (e) {
    console.error("[checkout] razorpay order failed:", e);
    return bad("Could not start the payment. Please try again in a moment.", 502);
  }

  // Link to the storefront account if the buyer is signed in (guest = none).
  const signedInCustomer = await getCurrentCustomer();

  // 2) Pending order in the CMS (staff visibility + verification lookup).
  const doc = await createOrder({
    orderNumber,
    customer: signedInCustomer?.id,
    name,
    email,
    phone: body.customer?.phone,
    company: body.customer?.company,
    addressLine1: body.address?.line1,
    addressLine2: body.address?.line2,
    city: body.address?.city,
    state: body.address?.state,
    pincode: body.address?.pincode,
    country: body.address?.country || "India",
    gstin: body.gstin,
    businessName: body.businessName,
    items: orderItems,
    subtotal,
    gstAmount,
    total,
    razorpayOrderId: rzp.id,
    displayCurrency,
    usdRateAtPurchase: displayCurrency === "USD" ? usdRate : undefined,
    totalUsdApprox,
  });
  if (!doc) {
    return bad("Could not record the order. Please try again.", 502);
  }

  return NextResponse.json({
    ok: true,
    keyId: razorpayKeyId(),
    razorpayOrderId: rzp.id,
    amount: rzp.amount, // paise
    currency: rzp.currency,
    orderNumber,
    total,
    // For Razorpay's display_currency option (USD shown inside the modal).
    totalUsdApprox,
  });
}
