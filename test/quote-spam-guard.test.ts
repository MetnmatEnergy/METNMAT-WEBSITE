import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mintFormToken } from "../apps/website/src/backend/lib/form-guard";

/**
 * POST /api/quote, end to end through the spam guard.
 *
 * The incident: on 2026-09-03/04 the form was used as a mail relay. Fake
 * names, fake addresses, and a "Thank you" email to each one that bounced and
 * cost sending reputation. These tests pin down the three promises the fix
 * makes — a bot is refused, a doubtful address gets no auto-reply but the lead
 * is still filed and the team still told, and even a clean submission cannot
 * trigger unlimited outbound mail.
 *
 * The CMS, the mailer and DNS are mocked; the rate limiter, the idempotency
 * store and the guard itself are real (in-memory — no UPSTASH_* in the env).
 */

const createEnquiry = vi.fn(async () => ({ ok: true, referenceId: "RFQ-20260917-TESTAA" }));
type MailOpts = { sendCustomerCopy?: boolean; suspectReasons?: string[] } | undefined;
const sendQuoteEmails = vi.fn(async (_e: unknown, _a: unknown, opts: MailOpts) => ({
  customer: opts?.sendCustomerCopy !== false,
  team: true,
  ...(opts?.sendCustomerCopy === false ? { customerSkipped: "suppressed" as const } : {}),
}));
const mailDomainVerdict = vi.fn(async () => "accepts" as "accepts" | "rejects" | "unknown");
const recordIntegrationLog = vi.fn(async () => {});

vi.mock("@/backend/services/enquiries.service", () => ({
  createEnquiry: (...a: unknown[]) => createEnquiry(...(a as [])),
  fetchEnquiryFileBase64: vi.fn(async () => null),
  uploadEnquiryFiles: vi.fn(async () => []),
}));
vi.mock("@/backend/lib/email", () => ({
  sendQuoteEmails: (...a: unknown[]) => sendQuoteEmails(...(a as [unknown, unknown, MailOpts])),
}));
vi.mock("@/backend/lib/email-mx", () => ({
  mailDomainVerdict: (...a: unknown[]) => mailDomainVerdict(...(a as [])),
}));
vi.mock("@/backend/services/orders.service", () => ({
  recordIntegrationLog: (...a: unknown[]) => recordIntegrationLog(...(a as [])),
}));

const ENV_KEYS = [
  "ATTACHMENT_SIGNING_SECRET",
  "INTERNAL_API_KEY",
  "TURNSTILE_SECRET_KEY",
  "TRUSTED_PROXY_IPS",
] as const;
let saved: Record<string, string | undefined>;
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ATTACHMENT_SIGNING_SECRET = "test-form-secret";
  mailDomainVerdict.mockResolvedValue("accepts");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  ({ POST } = await import("@/app/api/quote/route"));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // Fresh in-memory limiter + idempotency store for every test.
  vi.resetModules();
});

/** A token old enough that a person could have filled the form. */
const agedToken = () => mintFormToken(Date.now() - 10_000)!;

const submit = (extra: Record<string, unknown> = {}, ip = "203.0.113.9") =>
  POST(
    new Request("https://www.metnmat.com/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        name: "Dr Anita Rao",
        email: "anita@lab.example",
        message: "We need a custom reference electrode for a 3-electrode cell.",
        ...extra,
      }),
    })
  );

const mailOpts = (call = 0): MailOpts => sendQuoteEmails.mock.calls[call]?.[2];

// ── Timing-token mode (no Turnstile secret) ──────────────────────────────────

describe("POST /api/quote — bot check without Turnstile", () => {
  it("refuses a scripted POST that never fetched a form token", async () => {
    const res = await submit({});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, code: "bot-check", reason: "form-token-missing" });
    expect(body.error).toMatch(/refresh the page/i);
    expect(createEnquiry).not.toHaveBeenCalled();
    expect(sendQuoteEmails).not.toHaveBeenCalled();
  });

  it("refuses a submission faster than a person could fill the form", async () => {
    const res = await submit({ formToken: mintFormToken() });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("form-token-too_fast");
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("accepts a submission with a token old enough to have been typed behind", async () => {
    const res = await submit({ formToken: agedToken() });
    expect(res.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(mailOpts()).toEqual({ sendCustomerCopy: true, suspectReasons: [] });
  });

  it("still refuses the honeypot first, before any of this", async () => {
    const res = await submit({ formToken: agedToken(), hp_company_url: "http://spam" });
    expect(res.status).toBe(400);
    expect((await res.json()).fields?._rejected).toBeTruthy();
  });

  it("releases the idempotency key on refusal, so the person's retry is not 'already in flight'", async () => {
    const requestId = "guard-retry-key-01";
    expect((await submit({ requestId, formToken: mintFormToken() })).status).toBe(400);
    const retry = await submit({ requestId, formToken: agedToken() });
    expect(retry.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
  });
});

// ── Address sanity ───────────────────────────────────────────────────────────

describe("POST /api/quote — doubtful addresses", () => {
  it("files the lead and tells the team, but sends NO auto-reply, when the domain takes no mail", async () => {
    mailDomainVerdict.mockResolvedValue("rejects");
    const res = await submit({ formToken: agedToken(), email: "FS@JFOWI.COM" });
    expect(res.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(mailOpts()).toEqual({
      sendCustomerCopy: false,
      suspectReasons: ["email-domain-no-mail"],
    });
    // The success screen must not claim a copy was emailed.
    expect((await res.json()).emailedCustomer).toBe(false);
  });

  it("does not log a withheld copy as an email failure", async () => {
    mailDomainVerdict.mockResolvedValue("rejects");
    await submit({ formToken: agedToken(), email: "FS@JFOWI.COM" });
    // Give the fire-and-forget log a tick to run, if it were going to.
    await new Promise((r) => setTimeout(r, 0));
    expect(recordIntegrationLog).not.toHaveBeenCalled();
  });

  it("still logs a copy that was attempted and failed", async () => {
    sendQuoteEmails.mockResolvedValueOnce({ customer: false, team: true });
    await submit({ formToken: agedToken() });
    await new Promise((r) => setTimeout(r, 0));
    expect(recordIntegrationLog).toHaveBeenCalledTimes(1);
    expect(recordIntegrationLog.mock.calls[0]![0]).toMatchObject({
      integration: "quote-email",
      summary: expect.stringContaining("customer confirmation did not send"),
    });
  });

  it("does not hold a DNS hiccup against the customer", async () => {
    mailDomainVerdict.mockResolvedValue("unknown");
    await submit({ formToken: agedToken() });
    expect(mailOpts()?.sendCustomerCopy).toBe(true);
    expect(mailOpts()?.suspectReasons).toEqual([]);
  });
});

// ── Auto-reply budget ────────────────────────────────────────────────────────

describe("POST /api/quote — auto-reply budget", () => {
  it("sends at most two auto-replies to one address per day; the enquiries are all still filed", async () => {
    for (const requestId of ["budget-key-000001", "budget-key-000002", "budget-key-000003"]) {
      expect((await submit({ requestId, formToken: agedToken() })).status).toBe(201);
    }
    expect(createEnquiry).toHaveBeenCalledTimes(3);
    expect(mailOpts(0)?.sendCustomerCopy).toBe(true);
    expect(mailOpts(1)?.sendCustomerCopy).toBe(true);
    expect(mailOpts(2)?.sendCustomerCopy).toBe(false);
    // Over budget is not suspicion: the team notification is untagged.
    expect(mailOpts(2)?.suspectReasons).toEqual([]);
  });

  it("counts plus-addressed and re-cased variants against the same address", async () => {
    await submit({
      requestId: "variant-key-0001",
      formToken: agedToken(),
      email: "anita+a@lab.example",
    });
    await submit({
      requestId: "variant-key-0002",
      formToken: agedToken(),
      email: "anita+b@lab.example",
    });
    await submit({
      requestId: "variant-key-0003",
      formToken: agedToken(),
      email: "Anita@Lab.Example",
    });
    expect(mailOpts(2)?.sendCustomerCopy).toBe(false);
  });

  it("never lets a suspect submission spend a real customer's budget", async () => {
    mailDomainVerdict.mockResolvedValueOnce("rejects").mockResolvedValueOnce("rejects");
    await submit({ requestId: "spend-key-000001", formToken: agedToken() });
    await submit({ requestId: "spend-key-000002", formToken: agedToken() });
    // The same address, now with a domain that resolves: budget untouched.
    await submit({ requestId: "spend-key-000003", formToken: agedToken() });
    expect(mailOpts(2)?.sendCustomerCopy).toBe(true);
  });
});

// ── Turnstile mode ───────────────────────────────────────────────────────────

function stubSiteverify(reply: { success: boolean } | Error) {
  const calls: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body ?? "{}")));
      if (!url.includes("siteverify")) throw new Error(`unexpected fetch ${url}`);
      if (reply instanceof Error) throw reply;
      return new Response(JSON.stringify(reply), { status: 200 });
    })
  );
  return calls;
}

describe("POST /api/quote — with Turnstile configured", () => {
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAA-test-secret";
  });

  it("refuses a submission without a widget token — a timing token is no substitute", async () => {
    const calls = stubSiteverify({ success: true });
    const res = await submit({ formToken: agedToken() });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("turnstile-missing");
    expect(calls).toHaveLength(0);
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("refuses a token Cloudflare rejects", async () => {
    stubSiteverify({ success: false });
    const res = await submit({ turnstileToken: "tok_bad" });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe("turnstile-failed");
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("accepts a token Cloudflare confirms", async () => {
    stubSiteverify({ success: true });
    const res = await submit({ turnstileToken: "tok_good" });
    expect(res.status).toBe(201);
    expect(mailOpts()).toEqual({ sendCustomerCopy: true, suspectReasons: [] });
  });

  it("files the lead without an auto-reply, tagged, when Cloudflare cannot be reached", async () => {
    stubSiteverify(new Error("ECONNRESET"));
    const res = await submit({ turnstileToken: "tok_unknown" });
    expect(res.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(mailOpts()).toEqual({
      sendCustomerCopy: false,
      suspectReasons: ["turnstile-unavailable"],
    });
  });

  it("answers a double click from the idempotency store, not with a second (failing) verification", async () => {
    const calls = stubSiteverify({ success: true });
    const requestId = "turnstile-dup-key-1";
    const first = await submit({ requestId, turnstileToken: "tok_once" });
    expect(first.status).toBe(201);
    const second = await submit({ requestId, turnstileToken: "tok_once" });
    expect(second.status).toBe(200);
    expect((await second.json()).reference).toBe("RFQ-20260917-TESTAA");
    expect(calls).toHaveLength(1);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
  });
});

// ── The token endpoint ───────────────────────────────────────────────────────

describe("GET /api/quote/token", () => {
  it("hands out a token the guard will verify, and says whether it is required", async () => {
    const { GET } = await import("@/app/api/quote/token/route");
    const res = await GET(new Request("https://www.metnmat.com/api/quote/token"));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.required).toBe(true);
    expect(body.token).toMatch(/^\d{13}\.[A-Za-z0-9_-]{32}$/);

    const { verifyFormToken } = await import("@/backend/lib/form-guard");
    expect(verifyFormToken(body.token, Date.now() + 10_000).ok).toBe(true);
  });

  it("reports the check as off when no secret is configured", async () => {
    delete process.env.ATTACHMENT_SIGNING_SECRET;
    const { GET } = await import("@/app/api/quote/token/route");
    const body = await (await GET(new Request("https://www.metnmat.com/api/quote/token"))).json();
    expect(body).toEqual({ ok: true, token: null, required: false });
  });
});
