/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * NOTE: in-memory state is per-instance — it does NOT work across multiple
 * serverless instances or replicas. It's a sane default for a single instance.
 * TODO(backend): move to Redis (in the stack) for distributed rate limiting.
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000
): { ok: boolean; remaining: number; retryAfter?: number } {
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

/** Best-effort client IP from proxy headers. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
