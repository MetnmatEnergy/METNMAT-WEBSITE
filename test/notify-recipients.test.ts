import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyRecipients, sendQuoteEmails } from "../apps/website/src/backend/lib/email";

/**
 * QUOTE_NOTIFY_EMAIL / BLOG_NOTIFY_EMAIL can name more than one staff inbox.
 * Resend takes several recipients only as an array, so a comma-joined string
 * has to be split before it reaches `to` / `reply_to`.
 */

describe("notifyRecipients", () => {
  it("splits a comma-separated list and trims each address", () => {
    expect(notifyRecipients(" energy@metnmat.com, mk@metnmat.com ")).toEqual([
      "energy@metnmat.com",
      "mk@metnmat.com",
    ]);
  });

  it("accepts a semicolon and ignores empty entries", () => {
    expect(notifyRecipients("a@x.example;; b@x.example,")).toEqual(["a@x.example", "b@x.example"]);
  });

  it("falls through to the next variable, then to contact@", () => {
    expect(notifyRecipients(undefined, "sales@x.example")).toEqual(["sales@x.example"]);
    expect(notifyRecipients(" , ", "")).toEqual(["contact@metnmat.com"]);
  });
});

describe("team notification with two inboxes", () => {
  const ENV = ["RESEND_API_KEY", "QUOTE_FROM_EMAIL", "QUOTE_NOTIFY_EMAIL"] as const;
  let saved: Record<string, string | undefined>;
  let sent: Array<{ to: unknown; reply_to?: unknown }>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
    process.env.RESEND_API_KEY = "re_test_not_a_real_key";
    process.env.QUOTE_FROM_EMAIL = "METNMAT <noreply@metnmat.example>";
    process.env.QUOTE_NOTIFY_EMAIL = "energy@metnmat.example, mk@metnmat.example";
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

  it("addresses both inboxes, and lets the customer's reply reach both", async () => {
    await sendQuoteEmails({
      name: "Dr Anita Rao",
      email: "anita@lab.example",
      message: "We need a custom reference electrode for a 3-electrode cell.",
    });
    const both = ["energy@metnmat.example", "mk@metnmat.example"];
    expect(sent[0]!.to).toBe("anita@lab.example");
    expect(sent[0]!.reply_to).toEqual(both);
    expect(sent[1]!.to).toEqual(both);
  });
});
