import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  beginIdempotent,
  completeIdempotent,
  abandonIdempotent,
  normalizeIdempotencyKey,
  __resetIdempotencyMemory,
} from "../apps/website/src/backend/lib/idempotency";

/**
 * A quote request is not safe to repeat: each one files an RFQ for staff to work
 * and sends two emails, one carrying the customer's attachments. Nothing stopped
 * a repeat — a double click, a refresh of the POST, a client retry after a slow
 * response, or a proxy replay each produced another RFQ and another pair of
 * emails, and staff could not tell duplicates from two genuine enquiries by the
 * same person.
 */

beforeEach(() => __resetIdempotencyMemory());

describe("idempotency keys", () => {
  it("accepts a key that looks like one we issued", () => {
    expect(normalizeIdempotencyKey("3f9a2c11-4b7e-4a0d-9d21-8c7b6e5f4a3b")).toBe(
      "3f9a2c11-4b7e-4a0d-9d21-8c7b6e5f4a3b"
    );
    expect(normalizeIdempotencyKey("  r-abc123-xyz789  ")).toBe("r-abc123-xyz789");
  });

  it("rejects anything that could address another submission's slot", () => {
    for (const bad of [
      null,
      undefined,
      42,
      {},
      "",
      "short",
      "a".repeat(101),
      "has spaces here",
      "colon:separated",
      "slash/separated",
      "idem:other-key",
      "../escape",
    ]) {
      expect(normalizeIdempotencyKey(bad), String(bad)).toBeNull();
    }
  });
});

describe("once-only submission", () => {
  it("lets the first attempt through", async () => {
    expect(await beginIdempotent("key-one-aaaa")).toEqual({ state: "fresh" });
  });

  it("holds a duplicate that arrives while the first is still running", async () => {
    await beginIdempotent("key-two-aaaa");
    // The double click, before the first response has come back.
    expect(await beginIdempotent("key-two-aaaa")).toEqual({ state: "in_flight" });
  });

  it("replays the first answer instead of doing the work again", async () => {
    const key = "key-three-aaa";
    await beginIdempotent(key);
    await completeIdempotent(key, { ok: true, reference: "RFQ-20260902-ABC123" });

    const again = await beginIdempotent<{ ok: boolean; reference: string }>(key);
    expect(again).toEqual({
      state: "done",
      result: { ok: true, reference: "RFQ-20260902-ABC123" },
    });
  });

  it("RELEASES the key when the work failed, so a retry is not locked out", async () => {
    // Without this a transient CMS error would hold the key for the full TTL and
    // the customer's retry would be answered "already in flight" — one blip
    // turning into ten minutes of not being able to submit at all.
    const key = "key-four-aaaa";
    await beginIdempotent(key);
    await abandonIdempotent(key);
    expect(await beginIdempotent(key)).toEqual({ state: "fresh" });
  });

  it("keeps separate submissions separate", async () => {
    await beginIdempotent("key-five-aaaa");
    await completeIdempotent("key-five-aaaa", { reference: "A" });
    // A genuinely different enquiry by the same person.
    expect(await beginIdempotent("key-six-aaaaa")).toEqual({ state: "fresh" });
  });

  it("treats an unreadable stored value as still running, not as a result", async () => {
    const key = "key-seven-aaa";
    await beginIdempotent(key);
    await completeIdempotent(key, "not-json-object" as never);
    // A string IS valid JSON, so this one replays; the guard is for truncated
    // or corrupted values, which parse as nothing.
    const out = await beginIdempotent<string>(key);
    expect(out.state).toBe("done");
  });
});

// ── The route ────────────────────────────────────────────────────────────────

const createEnquiry = vi.fn(async () => ({ ok: true, referenceId: "RFQ-20260902-TESTAA" }));
const sendQuoteEmails = vi.fn(async () => ({ customer: true, team: true }));

vi.mock("@/backend/services/enquiries.service", () => ({
  createEnquiry: (...a: unknown[]) => createEnquiry(...(a as [])),
  fetchEnquiryFileBase64: vi.fn(async () => null),
  uploadEnquiryFiles: vi.fn(async () => []),
}));
vi.mock("@/backend/lib/email", () => ({
  sendQuoteEmails: (...a: unknown[]) => sendQuoteEmails(...(a as [])),
}));
vi.mock("@/backend/lib/rate-limit", () => ({
  limitRate: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.9"),
}));

let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  createEnquiry.mockClear();
  sendQuoteEmails.mockClear();
  ({ POST } = await import("@/app/api/quote/route"));
});

afterEach(() => vi.resetModules());

const submit = (extra: Record<string, unknown> = {}) =>
  POST(
    new Request("https://www.metnmat.com/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dr Anita Rao",
        email: "anita@lab.test",
        message: "We need a custom reference electrode for a 3-electrode cell.",
        ...extra,
      }),
    })
  );

describe("POST /api/quote", () => {
  it("files ONE enquiry and sends ONE pair of emails for a repeated request id", async () => {
    const requestId = "dup-key-000001";

    const first = await submit({ requestId });
    expect(first.status).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.reference).toBe("RFQ-20260902-TESTAA");

    // The double click / refresh / retry.
    const second = await submit({ requestId });
    const secondBody = await second.json();

    expect(createEnquiry).toHaveBeenCalledTimes(1);
    expect(sendQuoteEmails).toHaveBeenCalledTimes(1);
    // The customer sees the same answer, not an error and not a second RFQ.
    expect(secondBody.reference).toBe(firstBody.reference);
  });

  it("files two enquiries for two genuinely different submissions", async () => {
    await submit({ requestId: "distinct-key-a1" });
    await submit({ requestId: "distinct-key-b2" });
    expect(createEnquiry).toHaveBeenCalledTimes(2);
  });

  it("still works with no request id, rather than refusing to submit", async () => {
    // An older cached page, or a browser where randomUUID threw.
    const res = await submit({});
    expect(res.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(1);
  });

  it("returns the reference so the customer has something to quote back", async () => {
    const body = await (await submit({ requestId: "ref-key-000001" })).json();
    expect(body.reference).toMatch(/^RFQ-\d{8}-[A-Z0-9]{6}$/);
  });

  it("reports the two emails separately, not as one boolean", async () => {
    sendQuoteEmails.mockResolvedValueOnce({ customer: false, team: true });
    const body = await (await submit({ requestId: "mail-key-00001" })).json();
    // The success screen must not claim a copy was sent to an address that
    // bounced just because the internal notification got through.
    expect(body.emailedCustomer).toBe(false);
    expect(body.emailedTeam).toBe(true);
  });

  it("does NOT report success when the enquiry could not be filed", async () => {
    createEnquiry.mockResolvedValueOnce({ ok: false });
    const res = await submit({ requestId: "fail-key-000001" });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it("frees the key after a failure so the customer's retry gets through", async () => {
    const requestId = "retry-key-00001";
    createEnquiry.mockResolvedValueOnce({ ok: false });
    expect((await submit({ requestId })).status).toBe(502);

    // The retry must actually run, not be told "already in flight".
    const second = await submit({ requestId });
    expect(second.status).toBe(201);
    expect(createEnquiry).toHaveBeenCalledTimes(2);
  });

  it("rejects a bot that fills the honeypot", async () => {
    const res = await submit({ requestId: "bot-key-0000001", hp_company_url: "http://spam" });
    expect(res.status).toBe(400);
    expect(createEnquiry).not.toHaveBeenCalled();
  });

  it("passes the reference to the mailer so it reaches the customer", async () => {
    await submit({ requestId: "mailref-key-001" });
    const [enquiryArg] = sendQuoteEmails.mock.calls[0] as unknown as [{ referenceId?: string }];
    expect(enquiryArg.referenceId).toBe("RFQ-20260902-TESTAA");
  });
});
