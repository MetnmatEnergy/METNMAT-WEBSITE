import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * "Hide from the storefront" has to mean hidden everywhere a customer can reach
 * a category. It used to mean two places.
 *
 * A staff member retired a department, ticked the box, watched it vanish from
 * /shop and the header menu, and reasonably concluded it was done. It was still
 * in the filter rail on /shop/all and on every category page, in the
 * sub-category chips, in site search, on its own live URL — pulled from the
 * sitemap but returning HTTP 200, which is the worst of both — and in the
 * breadcrumb (and BreadcrumbList JSON-LD) of every product filed under it.
 *
 * The second describe block is the other half of the rule, and the reason the
 * fix is not a blanket filter: hiding a department retires the department, not
 * the stock filed under it.
 */

const realFetch = globalThis.fetch;

const CATEGORIES = [
  { slug: "furnaces", name: "Furnaces", blurb: "Muffle & tubular" },
  { slug: "muffle", name: "Muffle Furnaces", parent: { slug: "furnaces" } },
  { slug: "retired-sub", name: "Retired Line", parent: { slug: "furnaces" }, hidden: true },
  { slug: "retired", name: "Retired Department", blurb: "Wound down", hidden: true },
];

const PRODUCTS = [
  { slug: "mf-1200", name: "Muffle Furnace 1200", category: { slug: "muffle" } },
  { slug: "old-line-kit", name: "Old Line Kit", category: { slug: "retired-sub" } },
];

/** A CMS that answers the list query, the by-slug query and the product query. */
function cmsAnswers() {
  return vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes("/api/categories")) {
      const m = /where\[slug\]\[equals\]=([^&]+)/.exec(u);
      const docs = m ? CATEGORIES.filter((c) => c.slug === decodeURIComponent(m[1]!)) : CATEGORIES;
      return new Response(JSON.stringify({ docs }), { status: 200 });
    }
    if (u.includes("/api/products")) {
      return new Response(JSON.stringify({ docs: PRODUCTS }), { status: 200 });
    }
    return new Response(JSON.stringify({ docs: [] }), { status: 200 });
  });
}

async function loadCms() {
  vi.resetModules();
  return import("../apps/website/src/frontend/lib/cms");
}

beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = cmsAnswers() as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("a hidden category is hidden on every public surface", () => {
  it("is absent from the list the filter rail is built from", async () => {
    const { getAllCategories } = await loadCms();
    expect((await getAllCategories()).map((c) => c.slug)).toEqual(["furnaces", "muffle"]);
  });

  it("is absent from the sub-category chips of its visible parent", async () => {
    const { getSubCategories } = await loadCms();
    expect((await getSubCategories("furnaces")).map((c) => c.slug)).toEqual(["muffle"]);
  });

  it("is not offered by site search", async () => {
    const { searchSite } = await loadCms();
    const { links } = await searchSite("Retired");
    expect(links.filter((l) => l.type === "Category")).toEqual([]);
  });

  it("has no page of its own — the route may legitimately 404", async () => {
    // shop/c/[category]/page.tsx calls notFound() on null, in generateMetadata
    // as well as the page, so a null here is a real 404 STATUS.
    const { getCategoryBySlug } = await loadCms();
    await expect(getCategoryBySlug("retired")).resolves.toBeNull();
    await expect(getCategoryBySlug("retired-sub")).resolves.toBeNull();
  });

  it("is not linked from the breadcrumb of a product filed under it", async () => {
    // shop/p/[slug]/page.tsx renders the crumb — and the BreadcrumbList JSON-LD
    // entry — only when this resolves, so a null degrades the trail to
    // Home > Shop > Product instead of linking a retired department.
    const { getCategoryBySlug } = await loadCms();
    expect(await getCategoryBySlug("retired-sub")).toBeNull();
  });
});

describe("what hiding a department must NOT do", () => {
  it("leaves visible categories exactly as they were", async () => {
    const { getCategoryBySlug, getVisibleTopCategories } = await loadCms();
    expect((await getCategoryBySlug("furnaces"))?.name).toBe("Furnaces");
    expect((await getVisibleTopCategories()).map((c) => c.slug)).toEqual(["furnaces"]);
  });

  it("keeps a product in a hidden SUB-category listed on its visible parent", async () => {
    const { getProductsByCategory } = await loadCms();
    const slugs = (await getProductsByCategory("furnaces")).map((p) => p.slug);
    expect(slugs).toContain("old-line-kit");
    expect(slugs).toContain("mf-1200");
  });

  it("still tells a CMS outage apart from 'no such category'", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("upstream", { status: 503 })
    ) as unknown as typeof fetch;
    const { getCategoryBySlug, getAllCategories, CmsUnavailableError } = await loadCms();
    await expect(getCategoryBySlug("furnaces")).rejects.toBeInstanceOf(CmsUnavailableError);
    await expect(getAllCategories()).resolves.toEqual([]);
  });
});
