import { NextResponse, type NextRequest } from "next/server";

/**
 * Canonical-host redirect.
 *
 * The site answers on BOTH `metnmat.com` and `www.metnmat.com`. Every auth cookie
 * we set is host-only — `mm-customer` carries no `Domain`, and the OAuth handshake
 * cookies use the `__Host-` prefix, which *forbids* one. So a session established
 * on one host is invisible on the other:
 *
 *  - Sign in on www, reopen the tab on the apex (bookmark, typed URL, session
 *    restore) → no cookie is sent → the customer looks signed out.
 *  - Start Google sign-in on the apex → `__Host-mm-oauth-state` is written on the
 *    apex, but `redirect_uri` is pinned to NEXT_PUBLIC_SITE_URL (www), so Google
 *    returns to www, the callback finds no state cookie, and sign-in always fails.
 *
 * Collapsing every request onto the one canonical origin fixes both. 308 (rather
 * than 301/302) preserves the method and body, so a POST to an API route survives
 * the redirect intact.
 *
 * Only hosts inside our own registrable domain are canonicalised — the underlying
 * *.run.app origin (health checks, Cloud Build probes) and localhost are left alone.
 */
const CANONICAL_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

function canonicalHost(): string | null {
  if (!CANONICAL_ORIGIN) return null;
  try {
    return new URL(CANONICAL_ORIGIN).host;
  } catch {
    return null;
  }
}

/**
 * Endpoints that MACHINES call, which must work on whichever host they were
 * registered against.
 *
 * The canonical redirect exists for browsers carrying host-only cookies. A
 * payment provider carries no cookies and — crucially — does not follow
 * redirects on webhook delivery: it sees the 308, records a failed delivery, and
 * retries into the same 308 until it gives up. Nothing on our side logs anything,
 * because the request never reaches the route. Confirmed against production:
 * GET https://metnmat.com/api/checkout/webhook answers 308.
 *
 * So a webhook registered on the apex fails silently and permanently, and the
 * only symptom is orders that stay unpaid while the money has moved. Serving
 * these on both hosts is strictly safer than depending on a dashboard setting
 * somewhere else being exactly right.
 *
 * Signature verification is unaffected — it is computed over the raw body, not
 * the host — so this widens no trust boundary.
 */
const HOST_AGNOSTIC_PATHS = ["/api/checkout/webhook"];

export function middleware(req: NextRequest): NextResponse {
  const target = canonicalHost();
  if (!target) return NextResponse.next();

  if (HOST_AGNOSTIC_PATHS.some((p) => req.nextUrl.pathname === p)) {
    return NextResponse.next();
  }

  const host = req.headers.get("host");
  if (!host || host === target) return NextResponse.next();

  // `www.metnmat.com` → registrable domain `metnmat.com`. Redirect the apex and
  // any sibling alias; ignore anything outside the domain (run.app, localhost).
  const registrable = target.replace(/^www\./, "");
  if (host !== registrable && !host.endsWith(`.${registrable}`)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.host = target;
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export const config = {
  // Skip Next's own static output and the favicon — they never carry a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
