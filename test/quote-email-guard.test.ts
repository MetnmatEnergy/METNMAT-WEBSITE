import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendQuoteEmails } from "../apps/website/src/backend/lib/email";

/**
 * The mailer's own gates on the "Thank you" copy. They live in the mailer, not
 * only in the route, so that every caller — /api/quote today, /api/contact's
 * fallback path, whatever comes next — inherits them.
 */

const ENV = ["RESEND_API_KEY", "QUOTE_FROM_EMAIL", "QUOTE_NOTIFY_EMAIL"] as const;
let saved: Record<string, string | undefined>;

type Sent = { to: string; subject: string; html: string; reply_to?: string };
let sent: Sent[];

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.RESEND_API_KEY = "re_test_not_a_real_key";
  process.env.QUOTE_FROM_EMAIL = "METNMAT <noreply@metnmat.example>";
  process.env.QUOTE_NOTIFY_EMAIL = "sales@metnmat.example";
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Sent;
      sent.push(body);
      return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
    })
  );
});

afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

const enquiry = {
  name: "Dr Anita Rao",
  email: "anita@lab.example",
  message: "We need a custom reference electrode for a 3-electrode cell.",
  referenceId: "RFQ-20260917-ABC123",
};

describe("sendQuoteEmails", () => {
  it("sends the customer copy and the team notification by default", async () => {
    const r = await sendQuoteEmails(enquiry);
    expect(r).toEqual({ customer: true, team: true });
    expect(sent.map((s) => s.to)).toEqual(["anita@lab.example", "sales@metnmat.example"]);
    expect(sent[0]!.subject).toMatch(/^Thank you for your request \(RFQ-20260917-ABC123\)/);
    expect(sent[1]!.subject).toBe(
      "New customization request from Dr Anita Rao (RFQ-20260917-ABC123)"
    );
    expect(sent[1]!.reply_to).toBe("anita@lab.example");
  });

  it("withholds the customer copy when asked, and says so without calling it a failure", async () => {
    const r = await sendQuoteEmails(enquiry, [], { sendCustomerCopy: false });
    expect(r).toEqual({ customer: false, team: true, customerSkipped: "suppressed" });
    expect(sent.map((s) => s.to)).toEqual(["sales@metnmat.example"]);
    // Withheld for budget, not suspicion: the notification is not tagged.
    expect(sent[0]!.subject).not.toMatch(/spam/i);
  });

  it("NEVER writes to an address that fails the syntax check, whatever the caller asked", async () => {
    const r = await sendQuoteEmails({ ...enquiry, email: "fbdfbdf@nowhere" }, [], {
      sendCustomerCopy: true,
    });
    expect(r).toEqual({ customer: false, team: true, customerSkipped: "syntax" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("sales@metnmat.example");
    // Resend validates Reply-To; a bad one would sink the whole notification.
    expect(sent[0]!.reply_to).toBeUndefined();
  });

  it("tags the team notification as possible spam and says why", async () => {
    await sendQuoteEmails(enquiry, [], {
      sendCustomerCopy: false,
      suspectReasons: ["email-domain-no-mail", "turnstile-unavailable"],
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(
      "[possible spam] New customization request from Dr Anita Rao (RFQ-20260917-ABC123)"
    );
    expect(sent[0]!.html).toContain("possible spam");
    expect(sent[0]!.html).toContain("email-domain-no-mail, turnstile-unavailable");
    expect(sent[0]!.html).toContain("no automatic reply was sent");
  });

  it("reports a copy that was attempted and refused by the provider as a real failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Sent;
        sent.push(body);
        const bounced = body.to === "anita@lab.example";
        return new Response(bounced ? "invalid recipient" : "{}", { status: bounced ? 422 : 200 });
      })
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await sendQuoteEmails(enquiry);
    expect(r).toEqual({ customer: false, team: true });
    expect(r.customerSkipped).toBeUndefined();
  });

  it("is a no-op without a Resend key", async () => {
    delete process.env.RESEND_API_KEY;
    expect(await sendQuoteEmails(enquiry)).toEqual({ customer: false, team: false });
    expect(sent).toHaveLength(0);
  });
});
