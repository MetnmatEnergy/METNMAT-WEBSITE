import { NextResponse } from "next/server";
import {
  buildAuthUrl,
  googleConfigured,
  pkceChallenge,
  randomToken,
  safeRedirect,
  siteBase,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  OAUTH_REDIRECT_COOKIE,
  OAUTH_PANE_COOKIE,
} from "@/backend/lib/google-oauth";
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

/**
 * Begin Google sign-in: mint CSRF `state` + PKCE verifier, stash them (and the
 * post-login redirect) in short-lived httpOnly cookies, and send the browser to
 * Google's consent screen.
 */
export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  // Open-redirect-safe: only our own origin, relative path (see safeRedirect).
  const redirectTo = safeRedirect(params.get("redirect"));
  // Which pane the user pressed the Google button on, so failures return there.
  const pane = params.get("pane") === "signup" ? "signup" : "login";

  // Send failures back to the pane they came from, carrying the destination, so
  // a checkout-bound customer isn't stranded on a bare /login.
  const back = (code: string) => {
    const qs = new URLSearchParams({ error: code });
    if (redirectTo && redirectTo !== "/account") qs.set("redirect", redirectTo);
    return NextResponse.redirect(new URL(`/${pane}?${qs}`, siteBase()));
  };

  if (!googleConfigured()) return back("google_unavailable");

  const rl = await limitRate(`google-start:${clientIp(req)}`, 15, 60_000);
  if (!rl.ok) return back("google_rate");

  const state = randomToken(24);
  const verifier = randomToken(48);

  const res = NextResponse.redirect(buildAuthUrl({ state, codeChallenge: pkceChallenge(verifier) }));
  res.cookies.set(OAUTH_STATE_COOKIE, state, tempCookie);
  res.cookies.set(OAUTH_VERIFIER_COOKIE, verifier, tempCookie);
  res.cookies.set(OAUTH_REDIRECT_COOKIE, redirectTo, tempCookie);
  res.cookies.set(OAUTH_PANE_COOKIE, pane, tempCookie);
  return res;
}
