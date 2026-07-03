import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Privacy-conscious anonymous visitor identity for blog reactions + view
 * dedupe. The browser holds an opaque `<random>.<hmac>` token in an httpOnly
 * cookie; the HMAC means tokens can't be minted or enumerated client-side, and
 * no raw IP or fingerprint is ever stored with a reaction.
 */

const SECRET = () =>
  process.env.BLOG_SIGNING_SECRET || process.env.INTERNAL_API_KEY || "dev-blog-secret";

export const VISITOR_COOKIE = "mm-visitor";
export const VIEWED_COOKIE = "mm-viewed";

const sign = (value: string): string =>
  createHmac("sha256", SECRET()).update(value).digest("base64url").slice(0, 24);

/** New unforgeable visitor token. */
export function mintVisitorToken(): string {
  const id = randomBytes(12).toString("base64url");
  return `${id}.${sign(id)}`;
}

/** The stable visitor id inside a token, or null if missing/forged. */
export function verifyVisitorToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || token.length > 120) return null;
  const id = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

// ── View dedupe cookie ────────────────────────────────────────────────────────
// Compact "id:dayStamp" list — an article counts one view per visitor per day.
// Capped so the cookie can't grow unbounded (oldest entries drop off).

const VIEWED_MAX_ENTRIES = 60;
export const VIEW_WINDOW_DAYS = 1;

export function parseViewedCookie(raw: string | undefined | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!raw) return map;
  for (const part of raw.split(",").slice(0, VIEWED_MAX_ENTRIES * 2)) {
    const [id, day] = part.split(":");
    const d = Number(day);
    if (id && /^[a-f0-9]{24}$/i.test(id) && Number.isInteger(d) && d > 0) map.set(id, d);
  }
  return map;
}

export function serializeViewedCookie(map: Map<string, number>): string {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, VIEWED_MAX_ENTRIES);
  return entries.map(([id, day]) => `${id}:${day}`).join(",");
}

const dayStamp = (now = Date.now()): number => Math.floor(now / 86_400_000);

/**
 * Should this request count as a fresh view? Returns the updated cookie value
 * when yes, or null when the article was already viewed inside the window.
 */
export function registerView(
  raw: string | undefined | null,
  articleId: string,
  now = Date.now(),
): string | null {
  const map = parseViewedCookie(raw);
  const last = map.get(articleId);
  const today = dayStamp(now);
  if (last !== undefined && today - last < VIEW_WINDOW_DAYS) return null;
  map.set(articleId, today);
  return serializeViewedCookie(map);
}
