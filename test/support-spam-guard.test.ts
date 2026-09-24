import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mintFormToken } from "../apps/website/src/backend/lib/form-guard";

/**
 * POST /api/support through the same spam guard as /api/quote.
 *
 * In September 2026 the support inbox filled with tickets named in random
 * letters, each of which sent a confirmation — echoing the submitted subject —
 * to whatever address was typed in. The endpoint had only a per-IP rate limit.
 *
 * The CMS, the mailer and DNS are mocked; the limiter and the guard are real.
 */

const createTicket = vi.fn(async () => ({ id: "t1" }));
type MailOpts = { sendCustomerCopy?: boolean; suspectReasons?: string[] } | undefined;
const sendTicketEmails = vi.fn(async (_i: unknown, opts: MailOpts) => opts?.sendCustomerCopy !== false);
const mailDomainVerdict = vi.fn(async () => "accepts" as "accepts" | "rejects" | "unknown");

vi.mock("@/backend/services/tickets.service", () => ({
  createTicket: (...a: unknown[]) => createTicket(...(a as [])),
}));
vi.mock("@/backend/lib/email", () => ({
  sendTicketEmails: (...a: unknown[]) => sendTicketEmails(...(a as [unknown, MailOpts])),
}));
vi.mock("@/backend/lib/email-mx", () => ({
  mailDomainVerdict: (...a: unknown[]) => mailDomainVerdict(...(a as [])),
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
  ({ POST } = await import("@/app/api/support/route"));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
  createTicket.mockClear();
  sendTicketEmails.mockClear();
  vi.resetModules();
});

const agedToken = () => mintFormToken(Date.now() - 10_000)!;

const submit = (extra: Record<string, unknown> = {}, ip = "203.0.113.9") =>
  POST(
    new Request("https://www.metnmat.com/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        name: "Dr Anita Rao",
        email: "anita@lab.example",
        subject: "Electrode arrived cracked",
        description: "The glassy carbon electrode in order MM-1 arrived with a cracked body.",
        ...extra,
      }),
    })
  );

describe("POST /api/support — spam guard", () => {
  it("refuses a scripted POST with no form token, filing nothing and mailing nobody", async () => {
    const res = await submit();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "bot-check", reason: "form-token-missing" });
    expect(createTicket).not.toHaveBeenCalled();
    expect(sendTicketEmails).not.toHaveBeenCalled();
  });

  it("refuses a submission faster than a person could fill the form", async () => {
    const res = await submit({ formToken: mintFormToken() });
    expect((await res.json()).reason).toBe("form-token-too_fast");
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("refuses a filled honeypot", async () => {
    const res = await submit({ formToken: agedToken(), mm_trap: "http://spam.example" });
    expect(res.status).toBe(400);
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("files a clean ticket and sends the confirmation", async () => {
    const res = await submit({ formToken: agedToken() });
    expect(await res.json()).toMatchObject({ ok: true, emailed: true });
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(sendTicketEmails.mock.calls[0]![1]).toEqual({ sendCustomerCopy: true, suspectReasons: [] });
  });

  it("still files a ticket to a domain that takes no mail, but withholds the confirmation and tags it", async () => {
    mailDomainVerdict.mockResolvedValue("rejects");
    const res = await submit({ formToken: agedToken(), email: "fs@jfowi.example" });
    expect(await res.json()).toMatchObject({ ok: true, emailed: false });
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(sendTicketEmails.mock.calls[0]![1]).toEqual({
      sendCustomerCopy: false,
      suspectReasons: ["email-domain-no-mail"],
    });
  });

  it("stops confirming to one address after the daily budget", async () => {
    // Different IPs so the per-IP request limit is not what stops it.
    for (let i = 0; i < 3; i++) await submit({ formToken: agedToken() }, `203.0.113.${20 + i}`);
    const opts = sendTicketEmails.mock.calls.map((c) => c[1]?.sendCustomerCopy);
    expect(opts).toEqual([true, true, false]);
    expect(createTicket).toHaveBeenCalledTimes(3);
  });
});
