import { NextResponse } from "next/server";
import { verifyKey } from "@/backend/lib/internal-key";
import { sendShipmentEmail } from "@/backend/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/notify-shipped — CMS → website bridge.
 *
 * The dashboard's Shipments hook calls this when a shipment is dispatched (the
 * website owns Resend — same pattern as /api/support/notify). Key-gated; never
 * callable by the public. Best-effort: a mail failure returns ok:false but the
 * shipment stays saved and tracking still shows in the customer's account.
 */
export async function POST(req: Request): Promise<Response> {
  if (!verifyKey(req, "CMS_SHIP_NOTIFY_KEY")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    orderNumber?: string;
    name?: string;
    email?: string;
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    items?: { productName?: string; qty?: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const orderNumber = String(body.orderNumber ?? "").trim();
  const email = String(body.email ?? "").trim();
  if (!orderNumber || !email) {
    return NextResponse.json({ error: "orderNumber and email are required." }, { status: 400 });
  }

  const ok = await sendShipmentEmail({
    orderNumber,
    name: String(body.name ?? "").trim() || "there",
    email,
    carrier: body.carrier?.trim() || undefined,
    trackingNumber: body.trackingNumber?.trim() || undefined,
    trackingUrl: body.trackingUrl?.trim() || undefined,
    items: (body.items ?? [])
      .filter((it) => it?.productName)
      .map((it) => ({ productName: String(it.productName), qty: Number(it.qty) || 1 })),
  });
  return NextResponse.json({ ok });
}
