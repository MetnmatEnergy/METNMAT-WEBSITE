import { createHash, randomBytes } from "crypto";

/**
 * Google Sign-In — server-side OAuth 2.0 Authorization Code flow with PKCE.
 * Dependency-free: the client secret and all token handling stay on the server,
 * and the `id_token` is read straight from Google's token endpoint over the
 * back-channel (TLS), so validating its claims (aud / iss / exp / email_verified)
 * is sufficient — no signature verification or extra library is required
 * (OIDC Core §3.1.3.7). Mirrors the repo's dependency-light style.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
// Clock-skew tolerance for id_token exp — small, to absorb minor clock drift
// only (the token is read fresh off the back-channel, so it's never legitimately
// expired here). NOT a grace period for already-expired tokens.
const CLOCK_SKEW_SEC = 5;

export const clientId = (): string => process.env.GOOGLE_CLIENT_ID || "";
const clientSecret = (): string => process.env.GOOGLE_CLIENT_SECRET || "";

/** True only when both halves of the OAuth client are configured. */
export const googleConfigured = (): boolean => Boolean(clientId() && clientSecret());

/** The site's own public origin (no trailing slash) — used to build redirects
 *  off our real domain rather than the underlying *.run.app host. */
export const siteBase = (): string =>
  (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Our callback URL — must EXACTLY match an Authorized redirect URI in Google. */
export const redirectUri = (): string => `${siteBase()}/api/account/google/callback`;

/**
 * Validate a post-login redirect target. Returns a SAFE relative path (default
 * "/account"). Rejects open-redirect tricks: backslashes (`/\evil.com`, which
 * WHATWG normalises to `//evil.com` → off-origin), protocol-relative `//host`,
 * and anything that resolves to a different origin. The origin comparison is the
 * load-bearing guard.
 */
export function safeRedirect(raw: string | null | undefined): string {
  if (!raw || raw.includes("\\")) return "/account";
  try {
    const base = new URL(siteBase());
    const u = new URL(raw, base);
    if (u.origin !== base.origin) return "/account";
    if (!u.pathname.startsWith("/") || u.pathname.startsWith("//")) return "/account";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/account";
  }
}

// Short-lived OAuth handshake cookie names. The `__Host-` prefix in production
// makes them strictly host-only (Secure + Path=/ + no Domain), so a sibling
// subdomain or non-secure same-site page can't plant/overwrite the CSRF state or
// PKCE verifier. Dev is non-Secure, where `__Host-` is rejected, so plain names.
const OAUTH_PREFIX = process.env.NODE_ENV === "production" ? "__Host-" : "";
export const OAUTH_STATE_COOKIE = `${OAUTH_PREFIX}mm-oauth-state`;
export const OAUTH_VERIFIER_COOKIE = `${OAUTH_PREFIX}mm-oauth-verifier`;
export const OAUTH_REDIRECT_COOKIE = `${OAUTH_PREFIX}mm-oauth-redirect`;
export const OAUTH_TEMP_COOKIES = [OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, OAUTH_REDIRECT_COOKIE] as const;

/** URL-safe random token (state, PKCE verifier). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

/** PKCE S256 challenge from a verifier. */
export const pkceChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

/** The Google consent-screen URL to redirect the browser to. */
export function buildAuthUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Validate an id_token received over the back-channel and extract the profile. */
export function validateIdToken(idToken: string): GoogleProfile | null {
  const c = decodeJwtClaims(idToken);
  if (!c) return null;
  if (c.aud !== clientId()) return null;
  if (!GOOGLE_ISSUERS.has(String(c.iss))) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof c.exp !== "number" || c.exp < now - CLOCK_SKEW_SEC) return null;
  if (typeof c.iat === "number" && c.iat > now + CLOCK_SKEW_SEC) return null;
  const email = typeof c.email === "string" ? c.email.toLowerCase() : "";
  const emailVerified = c.email_verified === true || c.email_verified === "true";
  if (!email || !emailVerified || !c.sub) return null;
  return {
    sub: String(c.sub),
    email,
    emailVerified: true,
    name: typeof c.name === "string" ? c.name : undefined,
    picture: typeof c.picture === "string" ? c.picture : undefined,
  };
}

/** Exchange the authorization code (with PKCE) and return the verified profile. */
export async function exchangeCodeForProfile({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleProfile | null> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code_verifier: codeVerifier,
  });
  let res: Response;
  try {
    res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { id_token?: string };
  if (!data.id_token) return null;
  return validateIdToken(data.id_token);
}
