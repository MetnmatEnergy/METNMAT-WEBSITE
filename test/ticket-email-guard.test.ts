import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTicketEmails } from "../apps/website/src/backend/lib/email";

/** The ticket mailer's gates on the customer confirmation, mirroring sendQuoteEmails. */

const ENV = ["RESEND_API_KEY", "QUOTE_FROM_EMAIL", "QUOTE_NOTIFY_EMAIL"] as const;
let saved: Record<string, string | undefined>;
let sent: Array<{ to: unknown; subject: string; reply_to?: unknown }>;

beforeEach(() => {
  saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env.RESEND_API_KEY = "re_test_not_a_real_key";
  process.env.QUOTE_FROM_EMAIL = "METNMAT <noreply@metnmat.example>";
  process.env.QUOTE_NOTIFY_EMAIL = "support@metnmat.example";
  sent = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
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

const ticket = {
  ticketNumber: "TKT-20260924-ABCDEFGHJK",
  name: "Dr Anita Rao",
  email: "anita@lab.example",
  subject: "Electrode arrived cracked",
  description: "The body is cracked.",
  category: "product-quality",
  statusUrl: "https://www.metnmat.com/support?view=status",
};

describe("sendTicketEmails", () => {
  it("confirms to the customer and alerts staff by default", async () => {
    expect(await sendTicketEmails(ticket)).toBe(true);
    expect(sent.map((s) => s.to)).toEqual(["anita@lab.example", ["support@metnmat.example"]]);
    expect(sent[1]!.subject).toBe("🎫 New ticket TKT-20260924-ABCDEFGHJK: Electrode arrived cracked");
  });

  it("withholds the confirmation for a suspect ticket and tags the staff alert", async () => {
    const r = await sendTicketEmails(ticket, {
      sendCustomerCopy: false,
      suspectReasons: ["email-domain-no-mail"],
    });
    expect(r).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual(["support@metnmat.example"]);
    expect(sent[0]!.subject).toMatch(/^\[possible spam\] /);
    expect(sent[0]!.reply_to).toBe("anita@lab.example");
  });

  it("never writes to, or sets Reply-To from, an address that fails the syntax check", async () => {
    await sendTicketEmails({ ...ticket, email: "not an address" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual(["support@metnmat.example"]);
    expect(sent[0]!.reply_to).toBeUndefined();
  });
});
