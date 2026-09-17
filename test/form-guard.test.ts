import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mintFormToken,
  verifyFormToken,
  formTokenEnabled,
  FORM_TOKEN_MIN_AGE_MS,
  FORM_TOKEN_TTL_MS,
  turnstileConfigured,
  verifyTurnstile,
  screenSubmission,
  checkEmailSanity,
  autoReplyBudget,
  AUTO_REPLY_PER_ADDRESS,
  AUTO_REPLY_PER_IP,
} from "../apps/website/src/backend/lib/form-guard";
import {
  __setMailDnsForTests,
  __resetMailDomainCache,
  mailDomainVerdict,
  type MailDns,
} from "../apps/website/src/backend/lib/email-mx";

/**
 * The quote form sent a "Thank you" email to whatever address was typed in.
 * On 2026-09-03/04 that was used as a mail relay: fake names, fake addresses,
 * every reply bounced, every bounce charged to the sending domain's
 * reputation. These guard the layers that now sit between a POST and an
 * outbound email.
 */

const ENV_KEYS = [
  "ATTACHMENT_SIGNING_SECRET",
  "INTERNAL_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ATTACHMENT_SIGNING_SECRET = "test-form-secret";
  __resetMailDomainCache();
  __setMailDnsForTests(null);
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const NOW = 1_760_000_000_000;

// ── Timing token ─────────────────────────────────────────────────────────────

describe("form token", () => {
  it("verifies its own token once a person could have filled the form", () => {
    const token = mintFormToken(NOW)!;
    const v = verifyFormToken(token, NOW + FORM_TOKEN_MIN_AGE_MS + 500);
    expect(v).toEqual({ ok: true, ageMs: FORM_TOKEN_MIN_AGE_MS + 500 });
  });

  it("refuses a token submitted faster than a person types", () => {
    const token = mintFormToken(NOW)!;
    expect(verifyFormToken(token, NOW + 800)).toEqual({ ok: false, reason: "too_fast" });
  });

  it("refuses a token older than the TTL", () => {
    const token = mintFormToken(NOW)!;
    expect(verifyFormToken(token, NOW + FORM_TOKEN_TTL_MS + 1)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses a token minted under a different secret, or edited", () => {
    const token = mintFormToken(NOW)!;
    const [iat, mac] = token.split(".") as [string, string];

    process.env.ATTACHMENT_SIGNING_SECRET = "someone-elses-secret";
    expect(verifyFormToken(token, NOW + 10_000)).toEqual({ ok: false, reason: "forged" });
    process.env.ATTACHMENT_SIGNING_SECRET = "test-form-secret";

    // Backdating the timestamp to pass the age check must break the MAC.
    expect(verifyFormToken(`${Number(iat) - 60_000}.${mac}`, NOW + 500)).toEqual({
      ok: false,
      reason: "forged",
    });
    const flipped = mac[0] === "A" ? "B" : "A";
    expect(verifyFormToken(`${iat}.${flipped}${mac.slice(1)}`, NOW + 10_000)).toEqual({
      ok: false,
      reason: "forged",
    });
  });

  it("names a missing token and a malformed one differently", () => {
    for (const missing of [undefined, null, "", 42]) {
      expect(verifyFormToken(missing, NOW), String(missing)).toEqual({
        ok: false,
        reason: "missing",
      });
    }
    for (const malformed of ["abc", "123.456.789", "notdigits.mac", "1.".padEnd(80, "x")]) {
      expect(verifyFormToken(malformed, NOW), malformed).toEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  it("falls back to INTERNAL_API_KEY, and is OFF with neither", () => {
    delete process.env.ATTACHMENT_SIGNING_SECRET;
    process.env.INTERNAL_API_KEY = "internal-key";
    expect(formTokenEnabled()).toBe(true);
    expect(verifyFormToken(mintFormToken(NOW)!, NOW + 10_000).ok).toBe(true);

    delete process.env.INTERNAL_API_KEY;
    expect(formTokenEnabled()).toBe(false);
    expect(mintFormToken(NOW)).toBeNull();
    // Nothing to verify against: the check is off, not failing.
    expect(verifyFormToken(undefined, NOW).ok).toBe(true);
  });
});

// ── Turnstile ────────────────────────────────────────────────────────────────

type FetchCall = { url: string; body: Record<string, unknown> };

function stubSiteverify(reply: { status?: number; json?: unknown } | Error): {
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
      if (reply instanceof Error) throw reply;
      return new Response(JSON.stringify(reply.json ?? {}), { status: reply.status ?? 200 });
    })
  );
  return { calls };
}

describe("turnstile", () => {
  it("is configured only by a real secret — a placeholder does not switch it on", () => {
    expect(turnstileConfigured()).toBe(false);
    process.env.TURNSTILE_SECRET_KEY = "PLACEHOLDER_SET_ME";
    expect(turnstileConfigured()).toBe(false);
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    expect(turnstileConfigured()).toBe(true);
  });

  it("does not call Cloudflare without a token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    const { calls } = stubSiteverify({ json: { success: true } });
    expect(await verifyTurnstile(undefined, "203.0.113.9")).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await verifyTurnstile("", "203.0.113.9")).toEqual({ ok: false, reason: "missing" });
    expect(calls).toHaveLength(0);
  });

  it("passes a token Cloudflare accepts, sending the visitor's IP along", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    const { calls } = stubSiteverify({ json: { success: true } });
    expect(await verifyTurnstile("tok_abc", "203.0.113.9")).toEqual({ ok: true });
    expect(calls[0]!.url).toContain("challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(calls[0]!.body.response).toBe("tok_abc");
    expect(calls[0]!.body.remoteip).toBe("203.0.113.9");
  });

  it("fails a token Cloudflare refuses", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    stubSiteverify({ json: { success: false, "error-codes": ["invalid-input-response"] } });
    expect(await verifyTurnstile("tok_bad")).toEqual({ ok: false, reason: "failed" });
  });

  it("reports OUR misconfiguration and outages as unavailable, not as the visitor's failure", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    stubSiteverify({ json: { success: false, "error-codes": ["invalid-input-secret"] } });
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "unavailable" });

    stubSiteverify({ status: 503 });
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "unavailable" });

    stubSiteverify(new Error("ECONNRESET"));
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, reason: "unavailable" });
  });
});

// ── Screening ────────────────────────────────────────────────────────────────

describe("screenSubmission", () => {
  it("relies on the timing token when Turnstile is not configured", async () => {
    const aged = mintFormToken(Date.now() - 10_000)!;
    expect(await screenSubmission({ formToken: aged }, "203.0.113.9")).toEqual({ verdict: "pass" });

    const fresh = mintFormToken()!;
    const tooFast = await screenSubmission({ formToken: fresh }, "203.0.113.9");
    expect(tooFast.verdict).toBe("reject");
    if (tooFast.verdict === "reject") expect(tooFast.reason).toBe("form-token-too_fast");

    const none = await screenSubmission({}, "203.0.113.9");
    expect(none.verdict).toBe("reject");
    if (none.verdict === "reject") expect(none.reason).toBe("form-token-missing");
  });

  it("relies on Turnstile when configured — even without a timing token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    stubSiteverify({ json: { success: true } });
    expect(await screenSubmission({ turnstileToken: "tok" }, "203.0.113.9")).toEqual({
      verdict: "pass",
    });
  });

  it("refuses a failed or missing challenge, and merely suspects an unverifiable one", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test";
    vi.spyOn(console, "warn").mockImplementation(() => {});

    stubSiteverify({ json: { success: false, "error-codes": ["timeout-or-duplicate"] } });
    const failed = await screenSubmission({ turnstileToken: "tok" }, "203.0.113.9");
    expect(failed.verdict).toBe("reject");
    if (failed.verdict === "reject") {
      expect(failed.reason).toBe("turnstile-failed");
      expect(failed.error).toMatch(/refresh the page/i);
    }

    const missing = await screenSubmission({}, "203.0.113.9");
    expect(missing.verdict).toBe("reject");

    stubSiteverify(new Error("down"));
    expect(await screenSubmission({ turnstileToken: "tok" }, "203.0.113.9")).toEqual({
      verdict: "suspect",
      reasons: ["turnstile-unavailable"],
    });
  });

  it("passes everything when nothing is configured (a secret-less dev box)", async () => {
    delete process.env.ATTACHMENT_SIGNING_SECRET;
    expect(await screenSubmission({}, "203.0.113.9")).toEqual({ verdict: "pass" });
  });
});

// ── Address sanity ───────────────────────────────────────────────────────────

const dnsError = (code: string) => Object.assign(new Error(code), { code });

function fakeDns(over: Partial<MailDns>): MailDns & { calls: string[] } {
  const calls: string[] = [];
  const record =
    <T>(name: string, impl?: (d: string) => Promise<T>) =>
    async (d: string): Promise<T> => {
      calls.push(name);
      if (!impl) throw dnsError("ENOTFOUND");
      return impl(d);
    };
  return {
    calls,
    resolveMx: record("mx", over.resolveMx),
    resolve4: record("a", over.resolve4),
    resolve6: record("aaaa", over.resolve6),
  };
}

describe("checkEmailSanity", () => {
  it("fails syntax without asking DNS", async () => {
    const dns = fakeDns({ resolveMx: async () => [{ exchange: "mx.x.com", priority: 10 }] });
    __setMailDnsForTests(dns);
    expect(await checkEmailSanity("fbdfbdf")).toEqual({
      syntax: false,
      domain: "unknown",
      reasons: ["email-syntax"],
    });
    expect(dns.calls).toEqual([]);
  });

  it("accepts a domain with an MX record", async () => {
    __setMailDnsForTests(
      fakeDns({ resolveMx: async () => [{ exchange: "mx.lab.example", priority: 10 }] })
    );
    expect(await checkEmailSanity("jane@lab.example")).toEqual({
      syntax: true,
      domain: "accepts",
      reasons: [],
    });
  });

  it("accepts a domain with no MX but an address record (RFC 5321 fallback)", async () => {
    __setMailDnsForTests(fakeDns({ resolve4: async () => ["192.0.2.10"] }));
    expect((await checkEmailSanity("jane@a-only.example")).domain).toBe("accepts");
    __setMailDnsForTests(fakeDns({ resolve6: async () => ["2001:db8::1"] }));
    expect((await checkEmailSanity("jane@aaaa-only.example")).domain).toBe("accepts");
  });

  it("flags a domain with no mail server at all — the incident's addresses", async () => {
    __setMailDnsForTests(fakeDns({}));
    expect(await checkEmailSanity("FS@JFOWI.COM")).toEqual({
      syntax: true,
      domain: "rejects",
      reasons: ["email-domain-no-mail"],
    });
  });

  it("treats a null MX (RFC 7505) as an explicit refusal", async () => {
    __setMailDnsForTests(fakeDns({ resolveMx: async () => [{ exchange: ".", priority: 0 }] }));
    expect((await checkEmailSanity("x@nomail.example")).domain).toBe("rejects");
  });

  it("never holds a DNS hiccup against the customer", async () => {
    __setMailDnsForTests(
      fakeDns({
        resolveMx: async () => {
          throw dnsError("ETIMEOUT");
        },
      })
    );
    expect(await checkEmailSanity("jane@slow.example")).toEqual({
      syntax: true,
      domain: "unknown",
      reasons: [],
    });
  });

  it("caches answers per domain, but not unknowns", async () => {
    const dns = fakeDns({ resolveMx: async () => [{ exchange: "mx", priority: 1 }] });
    __setMailDnsForTests(dns);
    await mailDomainVerdict("Lab.Example", NOW);
    await mailDomainVerdict("lab.example", NOW + 1000);
    expect(dns.calls).toEqual(["mx"]);

    const flaky = fakeDns({
      resolveMx: async () => {
        throw dnsError("ESERVFAIL");
      },
    });
    __setMailDnsForTests(flaky);
    await mailDomainVerdict("flaky.example", NOW);
    await mailDomainVerdict("flaky.example", NOW);
    expect(flaky.calls.filter((c) => c === "mx")).toHaveLength(2);
  });
});

// ── Auto-reply budget ────────────────────────────────────────────────────────
// No UPSTASH_* in the test env, so this runs on the in-memory limiter; the keys
// are unique per test so suites cannot bleed into each other.

describe("autoReplyBudget", () => {
  it(`allows ${AUTO_REPLY_PER_ADDRESS} replies per address per day, then withholds`, async () => {
    const email = `budget-${Math.random()}@lab.example`;
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < AUTO_REPLY_PER_ADDRESS; i++) {
      expect(await autoReplyBudget(email, ip), `reply ${i + 1}`).toEqual({ ok: true });
    }
    expect(await autoReplyBudget(email, ip)).toEqual({ ok: false, exceeded: "address" });
  });

  it("counts case and plus-tag variants as the same address", async () => {
    const tag = Math.random().toString(36).slice(2);
    const ip = "198.51.100.250";
    await autoReplyBudget(`Person-${tag}+a@Lab.Example`, ip);
    await autoReplyBudget(`person-${tag}+b@lab.example`, ip);
    expect(await autoReplyBudget(`PERSON-${tag}@LAB.EXAMPLE`, ip)).toEqual({
      ok: false,
      exceeded: "address",
    });
  });

  it(`allows ${AUTO_REPLY_PER_IP} replies per IP per hour across different addresses`, async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < AUTO_REPLY_PER_IP; i++) {
      expect(await autoReplyBudget(`ip-${ip}-${i}@lab.example`, ip), `reply ${i + 1}`).toEqual({
        ok: true,
      });
    }
    expect(await autoReplyBudget(`ip-${ip}-last@lab.example`, ip)).toEqual({
      ok: false,
      exceeded: "ip",
    });
  });

  it("does not pool every visitor into one bucket when the IP is unknown", async () => {
    for (let i = 0; i < AUTO_REPLY_PER_IP + 2; i++) {
      expect(await autoReplyBudget(`unknown-${Math.random()}@lab.example`, "unknown")).toEqual({
        ok: true,
      });
    }
  });
});
