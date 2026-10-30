import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mintFormToken } from "../apps/website/src/backend/lib/form-guard";

/**
 * POST /api/contact — the team is emailed for every message, behind the same
 * spam guard as /api/quote and /api/support.
 *
 * Until 2026-10-30 the route emailed only when the CMS save failed, and that
 * branch tested `!saved` against an object, so it never ran: contact messages
 * reached the admin and nobody's inbox. The endpoint also had no bot check, so
 * random-letter submissions went straight to the WhatsApp group.
 *
 * The CMS, the mailer, the group alert and DNS are mocked; the limiter and the
 * guard are real.
 */

type Saved = { ok: boolean; referenceId?: string };
type MailOpts = { kind?: string; sendCustomerCopy?: boolean; suspectReasons?: string[] } | undefined;

const createEnquiry = vi.fn(async (): Promise<Saved> => ({ ok: true, referenceId: "RFQ-20261030-ABC123" }));
const sendQuoteEmails = vi.fn(async (_i: unknown, _a: unknown, _o: MailOpts) => ({
  customer: false,
  team: true,
  customerSkipped: "suppressed" as const,
}));
const alertResearchGroup = vi.fn(async () => true);
const recordIntegrationLog = vi.fn(async () => {});
const mailDomainVerdict = vi.fn(async () => "accepts" as "accepts" | "rejects" | "unknown");

vi.mock("@/backend/services/enquiries.service", () => ({
  createEnquiry: (...a: unknown[]) => createEnquiry(...(a as [])),
}));
vi.mock("@/backend/lib/email", () => ({
  sendQuoteEmails: (...a: unknown[]) => sendQuoteEmails(...(a as [unknown, unknown, MailOpts])),
}));
vi.mock("@/backend/lib/group-alert", () => ({
  alertResearchGroup: (...a: unknown[]) => alertResearchGroup(...(a as [])),
}));
vi.mock("@/backend/services/orders.service", () => ({
  recordIntegrationLog: (...a: unknown[]) => recordIntegrationLog(...(a as [])),
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
  vi.spyOn(console, "error").mockImplementation(() => {});
  ({ POST } = await import("@/app/api/contact/route"));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
  createEnquiry.mockClear();
  sendQuoteEmails.mockClear();
  alertResearchGroup.mockClear();
  recordIntegrationLog.mockClear();
  vi.resetModules();
});

const agedToken = () => mintFormToken(Date.now() - 10_000)!;

const submit = (extra: Record<string, unknown> = {}, ip = "203.0.113.9") =>
  POST(
    new Request("https://www.metnmat.com/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({
        name: "Dr Anita Rao",
        email: "anita@lab.example",
        company: "Institute of Electrochemistry",
        message: "Please quote a photocatalytic panel reactor with a 10 x 10 cm catalyst sheet.",
        ...extra,
      }),
    })
  );

describe("POST /api/contact", () => {
  it("emails the team for a clean message, files it, and alerts the group", async () => {
    const res = await submit({ formToken: agedToken() });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      ok: true,
      saved: true,
      reference: "RFQ-20261030-ABC123",
      emailedTeam: true,
    });
    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(sendQuoteEmails).toHaveBeenCalledTimes(1);
    const [input, attachments, opts] = sendQuoteEmails.mock.calls[0]!;
    expect(input).toMatchObject({ email: "anita@lab.example", referenceId: "RFQ-20261030-ABC123" });
    expect(attachments).toEqual([]);
    // Team only: the visitor gets the success screen, not an auto-reply.
    expect(opts).toEqual({ kind: "contact", sendCustomerCopy: false, suspectReasons: [] });
    expect(alertResearchGroup).toHaveBeenCalledTimes(1);
  });

  it("refuses a scripted POST with no form token, filing nothing and mailing nobody", async () => {
    const res = await submit();
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "bot-check", reason: "form-token-missing" });
    expect(createEnquiry).not.toHaveBeenCalled();
    expect(sendQuoteEmails).not.toHaveBeenCalled();
    expect(alertResearchGroup).not.toHaveBeenCalled();
  });

  it("refuses a submission faster than a person could fill the form", async () => {
    const res = await submit({ formToken: mintFormToken() });
    expect((await res.json()).reason).toBe("form-token-too_fast");
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("refuses a filled honeypot", async () => {
    const res = await submit({ formToken: agedToken(), mm_trap: "http://spam.example" });
    expect(res.status).toBe(400);
    expect(createEnquiry).not.toHaveBeenCalled();
    expect(sendQuoteEmails).not.toHaveBeenCalled();
  });

  it("still files and emails a message from a domain that takes no mail, tagged, but keeps it out of the group", async () => {
    mailDomainVerdict.mockResolvedValue("rejects");
    const res = await submit({ formToken: agedToken(), email: "fs@jfowi.example" });
    expect(res.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(sendQuoteEmails.mock.calls[0]![2]).toEqual({
      kind: "contact",
      sendCustomerCopy: false,
      suspectReasons: ["email-domain-no-mail"],
    });
    expect(alertResearchGroup).not.toHaveBeenCalled();
  });

  it("emails the team when the CMS save fails, and still accepts the message", async () => {
    createEnquiry.mockResolvedValueOnce({ ok: false });
    const res = await submit({ formToken: agedToken() });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true, saved: false, emailedTeam: true });
    expect(sendQuoteEmails).toHaveBeenCalledTimes(1);
    expect(alertResearchGroup).not.toHaveBeenCalled();
  });

  it("reports an error only when neither the CMS nor the team email took the message", async () => {
    createEnquiry.mockResolvedValueOnce({ ok: false });
    sendQuoteEmails.mockResolvedValueOnce({ customer: false, team: false, customerSkipped: "suppressed" });
    const res = await submit({ formToken: agedToken() });
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
  });

  it("records a failed team email where staff can see it", async () => {
    sendQuoteEmails.mockResolvedValueOnce({ customer: false, team: false, customerSkipped: "suppressed" });
    const res = await submit({ formToken: agedToken() });
    expect(res.status).toBe(201);
    expect(recordIntegrationLog).toHaveBeenCalledTimes(1);
    expect(recordIntegrationLog.mock.calls[0]![0]).toMatchObject({
      integration: "contact-email",
      status: "error",
    });
  });
});
