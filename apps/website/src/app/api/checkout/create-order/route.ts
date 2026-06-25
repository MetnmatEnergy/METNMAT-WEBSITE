import { NextResponse } from "next/server";
import { getProductBySlug, getUsdRate } from "@/frontend/lib/cms";
import { unitPriceForQty, inclGST, gstPortionOf, clampQty, usdFor } from "@/frontend/lib/catalog";
import { createRazorpayOrder, razorpayConfigured, razorpayKeyId } from "@/backend/lib/razorpay";
import { createOrder, type OrderItemInput } from "@/backend/services/orders.service";
import { getCurrentCustomer } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

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
  billingSameAsShipping?: boolean;
  billing?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  deliveryNotes?: string;
  marketingOptIn?: boolean;
  items?: { slug?: string; qty?: number; size?: string }[];
  /** Display context only — never used for amounts. */
  displayCurrency?: string;
};

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  // Throttle: this endpoint hits the Razorpay API and writes a CMS order per call.
  const rl = await limitRate(`checkout:${clientIp(req)}`, 12, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many checkout attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

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

  // Phone + shipping address are required server-side too (not just in the UI),
  // so a direct API call can never create a payable order we can't fulfil.
  const phone = body.customer?.phone?.trim() || "";
  if (phone.replace(/\D/g, "").length < 8) {
    return bad("Please provide a valid phone number.");
  }
  const addr = body.address ?? {};
  const country = (addr.country || "India").trim();
  const isIndia = /^india$/i.test(country);
  if (!addr.line1?.trim()) return bad("A shipping address (line 1) is required.");
  if (!addr.city?.trim()) return bad("Please provide a shipping city.");
  if (isIndia) {
    if (!addr.state?.trim()) return bad("Please provide the state for shipping within India.");
    if (!/^\d{6}$/.test((addr.pincode || "").trim())) {
      return bad("Please provide a valid 6-digit PIN code.");
    }
  } else if (!addr.pincode?.trim()) {
    return bad("Please provide a postal / ZIP code.");
  }

  const items = (body.items ?? []).filter(
    (i) => typeof i.slug === "string" && i.slug && Number.isFinite(i.qty) && (i.qty as number) > 0
  );
  if (!items.length) return bad("Your cart is empty.");
  if (items.length > 50) return bad("Too many items in one order.");

  // Recompute every price from the CMS (GST-inclusive, tier-aware). usdApprox is
  // summed PER LINE with the same logic the storefront uses (manual usdPrice
  // override, else live-rate convert) so the USD shown inside the Razorpay modal
  // matches the USD shown on the checkout page.
  const usdRate = await getUsdRate();
  const orderItems: OrderItemInput[] = [];
  let usdApprox = 0;
  for (const i of items) {
    const product = await getProductBySlug(i.slug as string);
    if (!product) return bad(`Product not found: ${i.slug}`);
    if (!product.price) {
      return bad(`"${product.name}" is quote-only — please request a quote for it.`);
    }
    // Note: inStock === false is "made to order" — orderable with a longer lead
    // time (the storefront presents it that way). Truly unavailable items are set
    // quote-only (handled above) or unpublished (never reach here).
    // Same clamp the cart uses client-side → the charged qty equals the shown qty.
    const qty = clampQty(product, i.qty as number);
    const unitIncl = inclGST(unitPriceForQty(product, qty));
    usdApprox += usdFor(product, unitIncl * qty) ?? (unitIncl * qty) / usdRate;
    orderItems.push({
      productName: product.name,
      slug: product.slug,
      sku: product.sku,
      size: i.size,
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
  const totalUsdApprox =
    displayCurrency === "USD" ? Math.round(usdApprox * 100) / 100 : undefined;

  // Human-friendly order number: MM-YYYYMMDD-XXXX
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const orderNumber = `MM-${ymd}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

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

  // Resolve the billing address. Default (and most common) is "same as
  // shipping", in which case we mirror the shipping fields so staff always have
  // an explicit Bill-To for the GST invoice. Otherwise use what was supplied.
  const billingSame = body.billingSameAsShipping !== false;
  const billing = billingSame
    ? {
        name,
        line1: addr.line1?.trim(),
        line2: addr.line2?.trim(),
        city: addr.city?.trim(),
        state: addr.state?.trim(),
        pincode: addr.pincode?.trim(),
        country,
      }
    : {
        name: body.billing?.name?.trim() || name,
        line1: body.billing?.line1?.trim(),
        line2: body.billing?.line2?.trim(),
        city: body.billing?.city?.trim(),
        state: body.billing?.state?.trim(),
        pincode: body.billing?.pincode?.trim(),
        country: body.billing?.country?.trim() || country,
      };

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
    country,
    gstin: body.gstin,
    businessName: body.businessName,
    billingSameAsShipping: billingSame,
    billingName: billing.name,
    billingLine1: billing.line1,
    billingLine2: billing.line2,
    billingCity: billing.city,
    billingState: billing.state,
    billingPincode: billing.pincode,
    billingCountry: billing.country,
    deliveryNotes: body.deliveryNotes?.trim() || undefined,
    marketingOptIn: body.marketingOptIn === true,
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
