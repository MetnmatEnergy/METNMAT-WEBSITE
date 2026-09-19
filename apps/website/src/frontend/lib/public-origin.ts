import { site } from "./site";

/**
 * The origin a browser should be sent to.
 *
 * Route handlers used `new URL(path, req.nextUrl.origin)` to build redirects.
 * Behind Caddy the Next server listens on 127.0.0.1:3100, and that is the
 * origin `nextUrl` reports — so the CMS Preview button, after switching draft
 * mode on, sent the director to http://localhost:3100/shop/p/<slug> (owner,
 * 2026-09-19). The answer is NEXT_PUBLIC_SITE_URL, which the production build
 * sets (deploy-web.yml) and which the Google sign-in routes already redirect
 * through (backend/lib/google-oauth siteBase); failing that, the canonical
 * site in production, and in development whatever host the browser used,
 * read from the proxy headers when present. Pure over its inputs so the rule
 * is unit-tested.
 */
export function publicOrigin(
  headers: Pick<Headers, "get">,
  env: { NODE_ENV?: string; NEXT_PUBLIC_SITE_URL?: string } = process.env,
): string {
  const configured = (env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (env.NODE_ENV === "production") return site.url.replace(/\/+$/, "");
  const host = headers.get("x-forwarded-host") || headers.get("host") || "localhost:3000";
  const proto =
    headers.get("x-forwarded-proto") || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
