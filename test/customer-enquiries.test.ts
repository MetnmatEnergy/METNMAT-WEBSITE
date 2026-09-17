import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The website half of the account-page enquiry read.
 *
 * The CMS honours the internal key on `enquiries` for exactly one query shape:
 * a top-level `where[email][equals]=<one address>`. Everything else is a 403.
 * So the URL this helper builds is a contract, not an implementation detail,
 * and the first test pins it.
 *
 * The second thing pinned is how a refusal surfaces. The old helper returned
 * [] on any non-2xx, which is how a 403 on EVERY request read as "no quote
 * requests yet" for months. A refusal must now be an error result the page can
 * render as one.
 */

const KEY = "website-test-internal-key";
const CMS = "http://cms.test:3001";

type Helper = typeof import("../apps/website/src/backend/lib/customer");
let getCustomerEnquiries: Helper["getCustomerEnquiries"];

const realFetch = globalThis.fetch;
let saved: { key?: string; cms?: string };

/** A verified customer whose account address is not already lower-case. */
const verified = {
  id: "cust-1",
  email: "Jane@Lab.Example",
  emailVerified: true,
};

/** A fetch mock that records the call and answers as told. */
function cmsAnswers(status: number, body: unknown = { docs: [] }) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(async () => {
  saved = { key: process.env.INTERNAL_API_KEY, cms: process.env.NEXT_PUBLIC_CMS_URL };
  process.env.INTERNAL_API_KEY = KEY;
  process.env.NEXT_PUBLIC_CMS_URL = CMS;
  vi.spyOn(console, "error").mockImplementation(() => {});
  // The module reads both env vars at import time.
  vi.resetModules();
  ({ getCustomerEnquiries } = await import("../apps/website/src/backend/lib/customer"));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
  if (saved.key === undefined) delete process.env.INTERNAL_API_KEY;
  else process.env.INTERNAL_API_KEY = saved.key;
  if (saved.cms === undefined) delete process.env.NEXT_PUBLIC_CMS_URL;
  else process.env.NEXT_PUBLIC_CMS_URL = saved.cms;
});

describe("getCustomerEnquiries: the query is the shape the CMS gate honours", () => {
  it("sends the internal key and exactly one where[email][equals], lower-cased", async () => {
    const calls = cmsAnswers(200, { docs: [] });
    await getCustomerEnquiries(verified);

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe(`${CMS}/api/enquiries`);
    expect(url.searchParams.get("where[email][equals]")).toBe("jane@lab.example");

    // The ONLY where parameter. An or/and/like here would be refused upstream.
    const whereKeys = [...url.searchParams.keys()].filter((k) => k.startsWith("where"));
    expect(whereKeys).toEqual(["where[email][equals]"]);

    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("x-internal-key")).toBe(KEY);
    expect(calls[0].init?.cache).toBe("no-store");
  });

  it("does not ask at all for an account that has not proven it owns the address", async () => {
    const calls = cmsAnswers(200, { docs: [{ id: "e1" }] });
    await expect(getCustomerEnquiries({ ...verified, emailVerified: false })).resolves.toEqual({
      ok: true,
      enquiries: [],
    });
    await expect(getCustomerEnquiries({ id: "c2", emailVerified: true })).resolves.toEqual({
      ok: true,
      enquiries: [],
    });
    await expect(getCustomerEnquiries(null)).resolves.toEqual({ ok: true, enquiries: [] });
    expect(calls).toHaveLength(0);
  });
});

describe("getCustomerEnquiries: a refusal is an error, not an empty history", () => {
  it("returns the customer's docs when the CMS answers", async () => {
    const docs = [{ id: "e1", productName: "Ag/AgCl reference electrode", status: "new" }];
    cmsAnswers(200, { docs });
    await expect(getCustomerEnquiries(verified)).resolves.toEqual({ ok: true, enquiries: docs });
  });

  it("reports a 403 as ok:false, the bug that hid for months", async () => {
    cmsAnswers(403, { errors: [{ message: "You are not allowed to perform this action." }] });
    await expect(getCustomerEnquiries(verified)).resolves.toEqual({ ok: false });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("403"));
  });

  it("reports a 5xx as ok:false", async () => {
    cmsAnswers(502, "bad gateway");
    await expect(getCustomerEnquiries(verified)).resolves.toEqual({ ok: false });
  });

  it("reports an unreachable CMS as ok:false", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(getCustomerEnquiries(verified)).resolves.toEqual({ ok: false });
  });

  it("never logs the address or the key when it logs a refusal", async () => {
    cmsAnswers(403);
    await getCustomerEnquiries(verified);
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .map(String)
      .join(" ");
    expect(logged).not.toContain("jane@lab.example");
    expect(logged).not.toContain(KEY);
  });
});
