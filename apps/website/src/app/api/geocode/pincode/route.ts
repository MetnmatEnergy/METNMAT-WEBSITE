import { NextResponse } from "next/server";
import { getCustomerToken } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Look up an Indian 6-digit pincode → district (city) + state, so the address
 * form can auto-fill City/State as the user types (the standard e-commerce
 * behaviour). Proxied server-side (same reason as the reverse-geocode route)
 * via the free, keyless India Post API.
 */
export async function GET(req: Request): Promise<Response> {
  const rl = await limitRate(`geocode-pin:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests — please wait a moment." }, { status: 429 });
  }
  if (!(await getCustomerToken())) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pin = String(searchParams.get("pin") || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "Invalid pincode." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
    const data = (await res.json()) as Array<{
      Status?: string;
      PostOffice?: Array<{ District?: string; State?: string }> | null;
    }>;
    const entry = Array.isArray(data) ? data[0] : null;
    const po = entry?.PostOffice?.[0];
    if (entry?.Status !== "Success" || !po) {
      return NextResponse.json({ found: false });
    }
    // India Post disambiguates districts that share a name across states by
    // appending the state code — "Raigarh(MH)" (402104) vs Raigarh in
    // Chhattisgarh. Strip it so it never lands verbatim in the City field.
    const city = String(po.District || "").replace(/\s*\([A-Za-z]{2,3}\)\s*$/, "").trim();
    return NextResponse.json({
      found: true,
      city,
      state: String(po.State || "").trim(),
    });
  } catch {
    return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
