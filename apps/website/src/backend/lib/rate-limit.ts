/**
 * Rate limiting.
 *
 * Prefers a SHARED store (Upstash Redis REST) so limits hold across all Cloud
 * Run instances; falls back to an in-memory fixed window when Upstash isn't
 * configured (local dev) or is temporarily unreachable (fail-open, so a Redis
 * blip never takes the site down). Set UPSTASH_REDIS_REST_URL + _TOKEN to enable
 * the distributed path — no code change at call sites.
 */

type Result = { ok: boolean; remaining: number; retryAfter?: number };

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const upstashEnabled = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// ── In-memory fallback (per-instance) ─────────────────────────────────────────
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowMs: number): Result {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.reset - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

// ── Distributed (Upstash Redis REST) ──────────────────────────────────────────
// Fixed window via a pipeline: SET key 0 EX ttl NX  (create+expire once) → INCR
// → TTL. The TTL is set only on creation, so the window doesn't slide under load.
async function upstashLimit(key: string, limit: number, windowMs: number): Promise<Result> {
  const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
  const k = `rl:${key}`;
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["SET", k, "0", "EX", String(ttlSec), "NX"],
      ["INCR", k],
      ["TTL", k],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as Array<{ result?: number | string | null; error?: string }>;
  const count = Number(data?.[1]?.result ?? 0);
  const ttlRaw = Number(data?.[2]?.result ?? ttlSec);
  const retryAfter = ttlRaw > 0 ? ttlRaw : ttlSec;
  if (count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: Math.max(0, limit - count) };
}

/**
 * Distributed-first rate limit. Returns { ok } — when false, `retryAfter` is in
 * seconds. Always resolves (never throws): Upstash errors fall back to memory.
 */
export async function limitRate(key: string, limit = 5, windowMs = 60_000): Promise<Result> {
  if (upstashEnabled) {
    try {
      return await upstashLimit(key, limit, windowMs);
    } catch (e) {
      console.warn("[rate-limit] Upstash unavailable, using in-memory fallback:", (e as Error).message);
    }
  }
  return memoryLimit(key, limit, windowMs);
}

/** @deprecated synchronous, in-memory only — prefer `await limitRate(...)`. */
export function rateLimit(key: string, limit = 5, windowMs = 60_000): Result {
  return memoryLimit(key, limit, windowMs);
}

/** Best-effort client IP from proxy headers. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
