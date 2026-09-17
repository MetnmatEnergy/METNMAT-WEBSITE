import { NextResponse } from "next/server";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";
import { mintFormToken, formTokenEnabled } from "@/backend/lib/form-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/quote/token — a signed timestamp the quote form sends back on submit.
 *
 * This is the fallback bot check for when Cloudflare Turnstile is not
 * configured (see form-guard.ts). The token is pure computation — no store, no
 * upstream call — so the endpoint cannot fail for want of a dependency, which
 * matters because the form cannot submit without it. Rate-limited anyway: it is
 * public and unauthenticated, and there is no reason for one client to need
 * more than a handful a minute.
 *
 * `required` tells the client whether the server will actually check the
 * token, so a page built against a secret-less dev server behaves the same way
 * as one built against production.
 */
export async function GET(request: Request) {
  const rl = await limitRate(`quote-token:${clientIp(request)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
    );
  }
  return NextResponse.json(
    { ok: true, token: mintFormToken(), required: formTokenEnabled() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
