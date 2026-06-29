import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForProfile, googleConfigured, siteBase } from "@/backend/lib/google-oauth";
import { CUSTOMER_COOKIE, cookieOptions } from "@/backend/lib/customer";
import { outboundKey } from "@/backend/lib/internal-key";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";
const TEMP_COOKIES = ["mm-oauth-state", "mm-oauth-verifier", "mm-oauth-redirect"] as const;

/**
 * Google OAuth callback. Validates CSRF state, exchanges the code (PKCE) for a
 * verified Google profile, asks the CMS to find/create/link the customer and
 * mint a Payload JWT, then sets the `mm-customer` cookie and returns the user to
 * their post-login destination. Any failure → /login?error=… (never leaks why).
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Always strip the short-lived OAuth cookies on the way out.
  const finish = (res: NextResponse): NextResponse => {
    for (const name of TEMP_COOKIES) res.cookies.set(name, "", { path: "/", maxAge: 0 });
    return res;
  };
  const fail = (code = "google") =>
    finish(NextResponse.redirect(new URL(`/login?error=${code}`, siteBase())));

  if (!googleConfigured()) return fail("google_unavailable");

  const rl = await limitRate(`google-cb:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return fail("google_rate");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const jar = await cookies();
  const stateCookie = jar.get("mm-oauth-state")?.value;
  const verifier = jar.get("mm-oauth-verifier")?.value;
  const redirectRaw = jar.get("mm-oauth-redirect")?.value || "/account";
  const redirectTo = redirectRaw.startsWith("/") && !redirectRaw.startsWith("//") ? redirectRaw : "/account";

  // User cancelled, or CSRF/state mismatch, or missing PKCE verifier.
  if (oauthError || !code || !state || !stateCookie || !verifier || state !== stateCookie) {
    return fail("google");
  }

  const profile = await exchangeCodeForProfile({ code, codeVerifier: verifier });
  if (!profile) return fail("google");

  try {
    const r = await fetch(`${CMS}/api/customers/oauth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": outboundKey("CMS_OAUTH_KEY") },
      body: JSON.stringify({
        email: profile.email,
        googleId: profile.sub,
        name: profile.name,
        emailVerified: profile.emailVerified,
        avatarUrl: profile.picture,
      }),
      cache: "no-store",
    });
    const data = (await r.json().catch(() => ({}))) as { token?: string; exp?: number };
    if (!r.ok || !data.token) return fail("google");

    const res = finish(NextResponse.redirect(new URL(redirectTo, siteBase())));
    const maxAge = data.exp ? Math.max(60, data.exp - Math.floor(Date.now() / 1000)) : undefined;
    res.cookies.set(CUSTOMER_COOKIE, data.token, cookieOptions(maxAge));
    return res;
  } catch {
    return fail("google");
  }
}
