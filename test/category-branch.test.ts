import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { categoryBranchSlugs } from "../apps/website/src/frontend/lib/catalog";

/**
 * A department page and the sitemap must agree about what belongs to a
 * department.
 *
 * They did not. The listing page collected sub-categories ONE level deep; the
 * sitemap's selectBrowsable walked the whole branch. `Categories.parent` has no
 * depth limit in the CMS, so the first time staff add a third level —
 * Electrodes → Reference Electrodes → Ag/AgCl — every product under the
 * grandchild disappears from the Electrodes page, which renders "No products in
 * this category yet", while the sitemap keeps submitting the URL to Google.
 */

const cat = (slug: string, parent?: string) => ({ slug, parent });

describe("categoryBranchSlugs", () => {
  it("is just the slug for a leaf", () => {
    expect(categoryBranchSlugs([cat("a")], "a")).toEqual(["a"]);
  });

  it("includes children AND grandchildren", () => {
    const cats = [cat("a"), cat("b", "a"), cat("c", "b"), cat("other")];
    expect(categoryBranchSlugs(cats, "a").sort()).toEqual(["a", "b", "c"]);
  });

  it("stops at the branch — a sibling's subtree is not included", () => {
    const cats = [cat("a"), cat("b", "a"), cat("x"), cat("y", "x")];
    expect(categoryBranchSlugs(cats, "a").sort()).toEqual(["a", "b"]);
  });

  it("returns the slug even when no such category exists", () => {
    expect(categoryBranchSlugs([], "gone")).toEqual(["gone"]);
  });

  it("terminates on a parent/child cycle instead of hanging", () => {
    const cats = [
      { slug: "x", parent: "y" },
      { slug: "y", parent: "x" },
    ];
    expect(categoryBranchSlugs(cats, "x").sort()).toEqual(["x", "y"]);
  });

  it("terminates on a self-parented category", () => {
    expect(categoryBranchSlugs([{ slug: "s", parent: "s" }], "s")).toEqual(["s"]);
  });
});

/**
 * The real fetcher, against a stubbed CMS — the same technique as
 * test/cms-availability.test.ts, so this exercises the shipped code path rather
 * than a re-implementation of it.
 *
 * The fixture is the three-level shape production does not have YET:
 *   electrodes
 *     └ reference-electrodes        (no products of its own)
 *         └ ag-agcl                 (holds the stock)
 *   consumables                     (an unrelated department)
 */
const CATEGORIES = [
  { slug: "electrodes", name: "Electrodes", order: 1 },
  {
    slug: "reference-electrodes",
    name: "Reference Electrodes",
    order: 2,
    parent: { slug: "electrodes" },
  },
  { slug: "ag-agcl", name: "Ag/AgCl", order: 3, parent: { slug: "reference-electrodes" } },
  { slug: "consumables", name: "Consumables", order: 4 },
];

const PRODUCTS = [
  { slug: "electrode-holder", name: "Electrode Holder", category: { slug: "electrodes" } },
  { slug: "ag-agcl-3m", name: "Ag/AgCl 3M KCl", category: { slug: "ag-agcl" } },
  { slug: "polishing-cloth", name: "Polishing Cloth", category: { slug: "consumables" } },
];

const realFetch = globalThis.fetch;

const cms = vi.fn(async (url: unknown) => {
  const docs = String(url).includes("/api/categories") ? CATEGORIES : PRODUCTS;
  return new Response(JSON.stringify({ docs }), { status: 200 });
});

async function loadCms() {
  vi.resetModules();
  return import("../apps/website/src/frontend/lib/cms");
}

beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = cms as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("getProductsByCategory across three levels", () => {
  it("a department includes products filed under a GRANDCHILD category", async () => {
    const { getProductsByCategory } = await loadCms();
    const slugs = (await getProductsByCategory("electrodes")).map((p) => p.slug).sort();
    // Before the fix this was ["electrode-holder"] — ag-agcl-3m was invisible.
    expect(slugs).toEqual(["ag-agcl-3m", "electrode-holder"]);
  });

  it("a mid-level category draws from its own descendants", async () => {
    const { getProductsByCategory } = await loadCms();
    const slugs = (await getProductsByCategory("reference-electrodes")).map((p) => p.slug);
    // Before the fix this was [] — the page said "No products in this category yet".
    expect(slugs).toEqual(["ag-agcl-3m"]);
  });

  it("does not reach outside the branch", async () => {
    const { getProductsByCategory } = await loadCms();
    const slugs = (await getProductsByCategory("electrodes")).map((p) => p.slug);
    expect(slugs).not.toContain("polishing-cloth");
  });

  it("a leaf category is unchanged: its own products only", async () => {
    const { getProductsByCategory } = await loadCms();
    expect((await getProductsByCategory("ag-agcl")).map((p) => p.slug)).toEqual(["ag-agcl-3m"]);
  });

  it("an unrelated department is unchanged", async () => {
    const { getProductsByCategory } = await loadCms();
    expect((await getProductsByCategory("consumables")).map((p) => p.slug)).toEqual([
      "polishing-cloth",
    ]);
  });

  /**
   * THE INVARIANT, and the reason the two walks were unified: every URL the
   * sitemap submits must render a page with products on it.
   */
  it("every category the sitemap submits has products on its page", async () => {
    const { getIndexableCategories, getProductsByCategory } = await loadCms();
    const indexable = (await getIndexableCategories()).map((c) => c.slug);
    expect(indexable).toContain("reference-electrodes");
    for (const slug of indexable) {
      const products = await getProductsByCategory(slug);
      expect(products.length, `sitemap lists /shop/c/${slug} but its page is empty`).toBeGreaterThan(
        0
      );
    }
  });
});
