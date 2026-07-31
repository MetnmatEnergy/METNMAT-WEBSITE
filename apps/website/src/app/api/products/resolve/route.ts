import { NextResponse } from "next/server";
import { getProductBySlug } from "@/frontend/lib/cms";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

/**
 * Resolve a list of product slugs to their CURRENT catalog products — used by
 * "Buy again" to rebuild a cart from a past order at today's prices/stock
 * (products that were removed or are now quote-only simply don't come back).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  // Throttled because this is a request amplifier: one unauthenticated POST can
  // fan out to 50 CMS lookups. "Buy again" fires it once per click, so 20/min
  // is far above real use and well below anything that could load the CMS.
  const rl = await limitRate(`resolve:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { products: [], error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }

  let body: { slugs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ products: [] }, { status: 400 });
  }
  const slugs = Array.isArray(body.slugs)
    ? (body.slugs.filter((s) => typeof s === "string" && s) as string[]).slice(0, 50)
    : [];
  if (!slugs.length) return NextResponse.json({ products: [] });

  const resolved = await Promise.all(slugs.map((s) => getProductBySlug(s)));
  return NextResponse.json({ products: resolved.filter(Boolean) });
}
