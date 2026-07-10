import { NextResponse } from "next/server";
import { getCustomerToken, patchCurrentCustomer, type Address } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

const clean = (a: Address): Address => ({
  label: String(a?.label ?? "").trim(),
  name: String(a?.name ?? "").trim(),
  phone: String(a?.phone ?? "").trim(),
  line1: String(a?.line1 ?? "").trim(),
  line2: String(a?.line2 ?? "").trim(), // locality
  landmark: String(a?.landmark ?? "").trim(),
  altPhone: String(a?.altPhone ?? "").trim(),
  city: String(a?.city ?? "").trim(),
  state: String(a?.state ?? "").trim(),
  pincode: String(a?.pincode ?? "").trim(),
  country: String(a?.country ?? "India").trim() || "India",
  addressType: a?.addressType === "home" || a?.addressType === "work" ? a.addressType : "",
  isDefault: !!a?.isDefault,
});

export async function POST(req: Request): Promise<Response> {
  const rl = await limitRate(`addresses:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many updates — please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  if (!(await getCustomerToken())) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  let body: { addresses?: Address[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!Array.isArray(body?.addresses)) {
    return NextResponse.json({ error: "Invalid addresses." }, { status: 400 });
  }
  // Keep only addresses with at least a line1, then enforce EXACTLY one default:
  // the first one flagged, or — when none is (the customer deleted or unchecked
  // the default) — the first address. Checkout reads the default first, so a list
  // with no default at all must never be persisted.
  let addresses = body.addresses.map(clean).filter((a) => a.line1);
  if (addresses.length > 0) {
    const flagged = addresses.findIndex((a) => a.isDefault);
    const defaultIdx = flagged === -1 ? 0 : flagged;
    addresses = addresses.map((a, i) => ({ ...a, isDefault: i === defaultIdx }));
  }

  const updated = await patchCurrentCustomer({ addresses });
  if (!updated) {
    return NextResponse.json(
      { error: "Couldn't save your addresses right now. Please try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ success: true, addresses: updated.addresses ?? [] });
}
