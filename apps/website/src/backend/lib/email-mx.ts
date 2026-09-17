import { Resolver } from "node:dns/promises";

/**
 * Does this domain accept mail at all?
 *
 * A syntax check catches `fbdfbdf` but not `FS@JFOWI.COM`: the address is
 * well-formed, the domain simply has nowhere to deliver to. Asking DNS before
 * we send is the difference between a bounce that counts against the sending
 * domain's reputation and a quiet decision not to try.
 *
 * Three answers, not two. "unknown" (a timeout, a SERVFAIL, a resolver that is
 * having a bad minute) must never be treated as "rejects" — a DNS hiccup on our
 * side is not evidence about the customer's address, and the caller falls back
 * to sending as it always did.
 *
 * Per RFC 5321 §5.1 a domain with no MX record but an A/AAAA record still
 * receives mail at that address, so the absence of MX alone is not a rejection.
 * A single null MX (`.`, RFC 7505) is an explicit "this domain takes no mail".
 */
export type MailDomainVerdict = "accepts" | "rejects" | "unknown";

export type MailDns = {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
};

/** Per-query budget. The submit is waiting on this, so it must stay short. */
const QUERY_TIMEOUT_MS = 2_500;
/** Wall-clock cap across the (up to three) queries; anything slower is "unknown". */
const TOTAL_TIMEOUT_MS = 3_500;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 1_000;

/** c-ares codes that mean "the name genuinely has no such record". */
const NEGATIVE = new Set(["ENOTFOUND", "ENODATA"]);

let dnsOverride: MailDns | null = null;

function dns(): MailDns {
  if (dnsOverride) return dnsOverride;
  // A fresh resolver per call: the per-query timeout is a constructor option,
  // and sharing one across concurrent submissions would share its state too.
  return new Resolver({ timeout: QUERY_TIMEOUT_MS, tries: 1 });
}

type Attempt<T> = { kind: "ok"; value: T } | { kind: "negative" } | { kind: "unknown" };

async function attempt<T>(q: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { kind: "ok", value: await q() };
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    return NEGATIVE.has(code) ? { kind: "negative" } : { kind: "unknown" };
  }
}

async function lookup(domain: string, d: MailDns): Promise<MailDomainVerdict> {
  const mx = await attempt(() => d.resolveMx(domain));
  if (mx.kind === "ok" && mx.value.length > 0) {
    const usable = mx.value.filter((r) => r.exchange && r.exchange !== ".");
    return usable.length ? "accepts" : "rejects";
  }
  if (mx.kind === "unknown") return "unknown";

  // No MX: fall back to the address records, as a sending MTA would.
  const a = await attempt(() => d.resolve4(domain));
  if (a.kind === "ok" && a.value.length > 0) return "accepts";
  const aaaa = await attempt(() => d.resolve6(domain));
  if (aaaa.kind === "ok" && aaaa.value.length > 0) return "accepts";
  if (a.kind === "unknown" || aaaa.kind === "unknown") return "unknown";
  return "rejects";
}

// ── Cache ────────────────────────────────────────────────────────────────────
// Positive and negative answers both cache: a burst of submissions from one
// domain — spam or a real customer retrying — should cost one lookup, not one
// per submission. "unknown" is never cached; the next attempt gets a fresh try.

type Cached = { verdict: MailDomainVerdict; expires: number };
const cache = new Map<string, Cached>();

function remember(domain: string, verdict: MailDomainVerdict, now: number): void {
  if (cache.size >= CACHE_MAX) {
    // Bounded work on a public path: drop the oldest insertions rather than
    // walking the whole map for expired entries.
    const drop = Math.ceil(CACHE_MAX / 10);
    let i = 0;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (++i >= drop) break;
    }
  }
  cache.set(domain, { verdict, expires: now + CACHE_TTL_MS });
}

/** Whether `domain` can receive mail. Never throws; never takes longer than ~3.5 s. */
export async function mailDomainVerdict(
  domain: string,
  now: number = Date.now()
): Promise<MailDomainVerdict> {
  const key = domain.trim().toLowerCase();
  if (!key) return "rejects";
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.verdict;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<MailDomainVerdict>((resolve) => {
    timer = setTimeout(() => resolve("unknown"), TOTAL_TIMEOUT_MS);
  });
  let verdict: MailDomainVerdict;
  try {
    verdict = await Promise.race([lookup(key, dns()), deadline]);
  } catch {
    verdict = "unknown";
  } finally {
    clearTimeout(timer);
  }
  if (verdict !== "unknown") remember(key, verdict, now);
  return verdict;
}

/** Test seam — substitute the resolver (null restores the real one). */
export function __setMailDnsForTests(d: MailDns | null): void {
  dnsOverride = d;
}

/** Test seam — drops cached verdicts. */
export function __resetMailDomainCache(): void {
  cache.clear();
}
