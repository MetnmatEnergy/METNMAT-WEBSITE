import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pins the FAQ query. The `active` checkbox in the CMS reads "Uncheck to hide",
 * but the website query did not filter on it — so an unchecked FAQ still
 * rendered AND was still emitted as FAQPage structured data, with no way for
 * staff to retract a published answer from Google short of deleting the record.
 *
 * These assertions are about the REQUEST, not the response: the bug was
 * invisible in the data (every FAQ happened to be active) and only existed in
 * the URL that was sent.
 */
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.resetModules();
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ docs: [] }) } as unknown as Response;
  });
});

const load = async () => (await import("../apps/website/src/frontend/lib/cms")).getFaqs;

describe("FAQ query", () => {
  it("excludes FAQs staff have unchecked", async () => {
    const getFaqs = await load();
    await getFaqs();
    expect(calls).toHaveLength(1);
    expect(decodeURIComponent(calls[0])).toContain("where[active][not_equals]=false");
  });

  it("uses not_equals:false, not equals:true — a doc written before the field existed has no `active` key and must still show", async () => {
    const getFaqs = await load();
    await getFaqs();
    expect(decodeURIComponent(calls[0])).not.toContain("where[active][equals]=true");
  });

  it("scopes by category when asked, so a page can emit only its own FAQPage", async () => {
    const getFaqs = await load();
    await getFaqs("Services");
    expect(decodeURIComponent(calls[0])).toContain("where[category][equals]=Services");
  });

  it("omits the category filter entirely when none is given", async () => {
    const getFaqs = await load();
    await getFaqs();
    expect(decodeURIComponent(calls[0])).not.toContain("where[category]");
  });

  it("url-encodes a category with a space rather than breaking the query", async () => {
    const getFaqs = await load();
    await getFaqs("Lab Equipment");
    expect(calls[0]).toContain("Lab%20Equipment");
  });
});
