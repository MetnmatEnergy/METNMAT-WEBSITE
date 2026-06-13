import { NextResponse } from "next/server";

/**
 * GET /api/geo — resolves the visitor's country to pick the display currency
 * (IN → INR, everywhere else → USD).
 *
 * Resolution order:
 *   1. Platform geo headers (Vercel / Cloudflare / generic) — free & instant
 *      in production behind a CDN.
 *   2. Server-side IP lookup via ipwho.is (keyless) using the forwarded client
 *      IP; with no forwarded IP (local dev) it geolocates the egress IP.
 *   3. Default: IN (primary market) — the site still renders fine either way.
 */
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() ?? "";
  // Loopback / private ranges are useless for geo — let the API use egress IP.
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return "";
  }
  return ip;
}

export async function GET(req: Request) {
  // 1) CDN/platform headers.
  const headerCountry =
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-country-code");
  let country = headerCountry && headerCountry !== "XX" ? headerCountry.toUpperCase() : "";

  // 2) IP lookup (keyless).
  if (!country) {
    try {
      const ip = clientIp(req);
      const res = await fetch(`https://ipwho.is/${ip}?fields=success,country_code`, {
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { success?: boolean; country_code?: string };
        if (j?.success && j.country_code) country = j.country_code.toUpperCase();
      }
    } catch {
      /* fall through to default */
    }
  }

  // 3) Default to the primary market.
  if (!country) country = "IN";

  return NextResponse.json(
    { country, currency: country === "IN" ? "INR" : "USD" },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}
