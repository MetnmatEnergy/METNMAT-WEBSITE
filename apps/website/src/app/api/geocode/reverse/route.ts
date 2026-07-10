import { NextResponse } from "next/server";
import { getCustomerToken } from "@/backend/lib/customer";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Reverse-geocode lat/lng → city / state / pincode for the address form's
 * "Use my current location" button. Proxied server-side so the browser only
 * talks same-origin (the CSP `connect-src` doesn't allow external hosts, and
 * this keeps the third-party call server-controlled). Uses BigDataCloud's free,
 * keyless reverse-geocode endpoint.
 */
export async function GET(req: Request): Promise<Response> {
  const rl = await limitRate(`geocode-rev:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests — please wait a moment." }, { status: 429 });
  }
  if (!(await getCustomerToken())) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal, headers: { accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
    const d = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      postcode?: string;
      countryName?: string;
    };
    return NextResponse.json({
      city: String(d?.city || d?.locality || "").trim(),
      state: String(d?.principalSubdivision || "").trim(),
      pincode: String(d?.postcode || "").trim(),
      locality: String(d?.locality || "").trim(),
      country: String(d?.countryName || "").trim(),
    });
  } catch {
    return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
