import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The bug this guards against.
 *
 * The CMS fetch wrapper collapsed three outcomes into one `null`: transport
 * failure, a non-2xx upstream, and a successful empty result. Every detail route
 * read that null as "this document does not exist" and called notFound(), so any
 * CMS unavailability — a restart, a 5xx, an Atlas blip — turned every product,
 * category, project and blog URL into a real HTTP 404.
 *
 * A 404 tells Google to drop the URL. A 5xx tells it to come back. So a few
 * minutes of CMS downtime could cost catalogue rankings, and nothing anywhere
 * signalled that a page had 404'd for the wrong reason.
 *
 * The distinction was already present elsewhere in the same file: getProjects()
 * treats a null from `api` as "unreachable, use placeholders" twelve lines above
 * getProjectFull() treating the identical null as "no such slug".
 */

const realFetch = globalThis.fetch;

/** A CMS that answers, with the given docs. */
const answersWith = (docs: unknown[]) =>
  vi.fn(async () => new Response(JSON.stringify({ docs }), { status: 200 }));

/** A CMS that is down at the transport level. */
const unreachable = vi.fn(async () => {
  throw new TypeError("fetch failed");
});

/** A CMS that answers, badly. */
const errors = (status: number) => vi.fn(async () => new Response("upstream", { status }));

async function loadCms() {
  vi.resetModules();
  return import("../apps/website/src/frontend/lib/cms");
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("a CMS that answers 'no such thing'", () => {
  it("returns null for a product, so the route may legitimately 404", async () => {
    globalThis.fetch = answersWith([]) as unknown as typeof fetch;
    const { getProductBySlug } = await loadCms();
    await expect(getProductBySlug("no-such-product")).resolves.toBeNull();
  });

  it("returns null for a category", async () => {
    globalThis.fetch = answersWith([]) as unknown as typeof fetch;
    const { getCategoryBySlug } = await loadCms();
    await expect(getCategoryBySlug("no-such-category")).resolves.toBeNull();
  });

  it("returns null for a project", async () => {
    globalThis.fetch = answersWith([]) as unknown as typeof fetch;
    const { getProjectFull } = await loadCms();
    await expect(getProjectFull("no-such-project")).resolves.toBeNull();
  });
});

describe("a CMS that does not answer", () => {
  it("THROWS for a product rather than reporting it missing", async () => {
    globalThis.fetch = unreachable as unknown as typeof fetch;
    const { getProductBySlug, CmsUnavailableError } = await loadCms();
    await expect(getProductBySlug("real-product")).rejects.toBeInstanceOf(CmsUnavailableError);
  });

  it("THROWS for a category", async () => {
    globalThis.fetch = unreachable as unknown as typeof fetch;
    const { getCategoryBySlug, CmsUnavailableError } = await loadCms();
    await expect(getCategoryBySlug("electrodes")).rejects.toBeInstanceOf(CmsUnavailableError);
  });

  it("THROWS for a project", async () => {
    globalThis.fetch = unreachable as unknown as typeof fetch;
    const { getProjectFull, CmsUnavailableError } = await loadCms();
    await expect(getProjectFull("real-project")).rejects.toBeInstanceOf(CmsUnavailableError);
  });

  it("treats a 5xx the same as being unreachable", async () => {
    globalThis.fetch = errors(503) as unknown as typeof fetch;
    const { getProductBySlug, CmsUnavailableError } = await loadCms();
    await expect(getProductBySlug("real-product")).rejects.toBeInstanceOf(CmsUnavailableError);
  });

  it("treats a 500 the same, since neither means 'no such slug'", async () => {
    globalThis.fetch = errors(500) as unknown as typeof fetch;
    const { getProjectFull, CmsUnavailableError } = await loadCms();
    await expect(getProjectFull("real-project")).rejects.toBeInstanceOf(CmsUnavailableError);
  });
});

describe("listings still degrade instead of erroring", () => {
  it("renders an empty catalogue rather than throwing when the CMS is down", async () => {
    // The listing pages legitimately show "nothing here"; only the DETAIL routes
    // needed the distinction, because only they turn a null into a 404.
    globalThis.fetch = unreachable as unknown as typeof fetch;
    const { getAllCategories } = await loadCms();
    await expect(getAllCategories()).resolves.toEqual([]);
  });

  it("falls back to placeholder projects when the CMS is down", async () => {
    globalThis.fetch = unreachable as unknown as typeof fetch;
    const { getProjects } = await loadCms();
    const projects = await getProjects();
    // getProjects has always treated an unreachable CMS as "use placeholders" —
    // the behaviour getProjectFull was missing.
    expect(Array.isArray(projects)).toBe(true);
  });
});
