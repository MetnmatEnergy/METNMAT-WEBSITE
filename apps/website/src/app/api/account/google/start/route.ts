import { NextResponse } from "next/server";
import { buildAuthUrl, googleConfigured, pkceChallenge, randomToken, siteBase } from "@/backend/lib/google-oauth";
import { limitRate, clientIp } from "@/backend/lib/rate-limit";

export const dynamic = "force-dynamic";

const TEN_MIN = 60 * 10;
const tempCookie = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: TEN_MIN,
};

/** Only allow internal, relative post-login redirects (no open-redirects). */
function safeRedirect(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/account";
}

/**
 * Begin Google sign-in: mint CSRF `state` + PKCE verifier, stash them (and the
 * post-login redirect) in short-lived httpOnly cookies, and send the browser to
 * Google's consent screen.
 */
export async function GET(req: Request): Promise<Response> {
  const back = (code: string) => NextResponse.redirect(new URL(`/login?error=${code}`, siteBase()));

  if (!googleConfigured()) return back("google_unavailable");

  const rl = await limitRate(`google-start:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return back("google_rate");

  const redirectTo = safeRedirect(new URL(req.url).searchParams.get("redirect"));
  const state = randomToken(24);
  const verifier = randomToken(48);

  const res = NextResponse.redirect(buildAuthUrl({ state, codeChallenge: pkceChallenge(verifier) }));
  res.cookies.set("mm-oauth-state", state, tempCookie);
  res.cookies.set("mm-oauth-verifier", verifier, tempCookie);
  res.cookies.set("mm-oauth-redirect", redirectTo, tempCookie);
  return res;
}
