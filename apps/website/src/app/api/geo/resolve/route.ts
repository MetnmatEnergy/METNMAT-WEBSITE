import { NextResponse } from "next/server";
import { clientIp, limitRate } from "@/backend/lib/rate-limit";
import { regionForCountry, type Region } from "@/frontend/lib/region";

/**
 * POST /api/geo/resolve — turn coordinates the visitor explicitly offered into
 * a country, and from that a shopping region.
 *
 * The browser knows where it is; it does not get to decide what that means.
 * Coordinates come in, a country goes out, and the region is derived here — so
 * "which region am I in" is answered by the same code path whether it came from
 * geolocation, from the IP, or from a manual choice.
 *
 * This is a display preference, not an authorisation decision. Nothing
 * security-bearing hangs off the answer: `create-order` recomputes every line
 * from the CMS and charges in INR regardless of the region in play.
 */
export const dynamic = "force-dynamic";

/** Reverse geocode. Keyless, and the same provider the address form already uses. */
const ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * A coordinate must arrive AS a number.
 *
 * Coercing instead would quietly accept the shapes a buggy caller actually
 * sends: Number(true) is 1, Number(null) and Number([]) are both 0. Each of
 * those passes a range check and becomes a real position in the Atlantic, so
 * the caller gets a confident region derived from input that meant nothing.
 */
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function POST(req: Request) {
  // A miss calls a shared keyless API. Region is chosen roughly once per visit,
  // so this is generous while still bounding what one client can burn.
  const rl = await limitRate(`geo-resolve:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  let lat: number | null = null;
  let lon: number | null = null;
  try {
    const body = (await req.json()) as { latitude?: unknown; longitude?: unknown };
    lat = finite(body?.latitude);
    lon = finite(body?.longitude);
  } catch {
    /* handled below */
  }

  // Values are interpolated into an outbound URL, so they are range-checked
  // rather than merely parsed.
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${ENDPOINT}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
      { signal: AbortSignal.timeout(4000), cache: "no-store" }
    );
    if (res.ok) {
      const j = (await res.json()) as { countryCode?: string; countryName?: string };
      const code = String(j?.countryCode ?? "").toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) {
        const region: Region = regionForCountry(code);
        return NextResponse.json(
          { region, country: code, countryName: j?.countryName ?? null },
          { headers: { "Cache-Control": "private, max-age=86400" } }
        );
      }
    }
  } catch {
    /* fall through */
  }

  // Coordinates were valid but could not be resolved. Say so rather than
  // guessing a region — the caller offers manual selection instead, which is a
  // better answer than a confidently wrong one.
  return NextResponse.json({ error: "Could not resolve location" }, { status: 502 });
}
