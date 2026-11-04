import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PRODUCT_COPY, productCopy, siblingProducts } from "../apps/website/src/frontend/lib/product-copy";
import { productSearchTerms } from "../apps/website/src/frontend/lib/product-terms";
import { GUIDES, guidesForCategory } from "../apps/website/src/frontend/lib/guides";
import { CATEGORY_SEO } from "../apps/website/src/frontend/lib/category-seo";
import { REFERENCE_ELECTRODES, toOtherReference, toRhe, toShe } from "../apps/website/src/frontend/lib/potential-convert";
import catalogue from "./fixtures/catalogue-2026-11-04.json";

const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");

describe("product content", () => {
  it.each(catalogue.map((p) => [p.name, p] as const))("%s has real content", (_name, p) => {
    const c = productCopy(p);
    expect(c, p.name).toBeDefined();
    expect(c!.about.split(/\s+/).length).toBeGreaterThanOrEqual(20);
    expect(c!.uses.length).toBeGreaterThanOrEqual(3);
    expect(c!.care.length).toBeGreaterThanOrEqual(2);
  });

  it("claims nothing that must come from a product's own record", () => {
    for (const [family, c] of Object.entries(PRODUCT_COPY)) {
      const text = JSON.stringify(c);
      expect(text, family).not.toMatch(/₹|\bISO\b|certified|in stock|ships? (in|within)|warranty|guarantee|\bbest\b|\bworld.?class\b/i);
      expect(text, family).not.toMatch(/made in|manufactured in/i);
    }
  });

  it("never calls a PFSA membrane Nafion", () => {
    expect(JSON.stringify(PRODUCT_COPY)).not.toMatch(/nafion/i);
  });

  it("compares a product only with others of the same plain name", () => {
    const all = catalogue.map((p, i) => ({ ...p, slug: `p${i}` }));
    const one = all.find((p) => p.name.startsWith("Hg/HgO Reference Electrode (Ø6 × 70"))!;
    const list = siblingProducts(one, all);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((p) => productSearchTerms(p)[0] === "Hg/HgO reference electrode")).toBe(true);
    expect(list.some((p) => p.slug === one.slug)).toBe(false);
  });

  it("shows on the page and reaches the feed", () => {
    expect(src("app/shop/p/[slug]/page.tsx")).toMatch(/<ProductTabs product=\{product\} copy=\{copy\} \/>/);
    expect(src("frontend/components/commerce/product-tabs.tsx")).toMatch(/Care and handling/);
    expect(src("frontend/lib/merchant-feed.ts")).toMatch(/productCopy\(p\)\?\.about/);
  });
});

describe("potential converter", () => {
  it("adds the reference potential for SHE", () => {
    expect(toShe(0.5, 0.197)).toBeCloseTo(0.697, 6);
  });

  it("adds the pH term for RHE", () => {
    // Hg/HgO in 1 M KOH at pH 14: 1.000 + 0.098 + 0.8288.
    expect(toRhe(1, 0.098, 14)).toBeCloseTo(1.9268, 4);
    expect(toRhe(0, 0, 0)).toBe(0);
  });

  it("converts between two references", () => {
    expect(toOtherReference(0.3, 0.241, 0.197)).toBeCloseTo(0.344, 6);
  });

  it("holds the textbook values", () => {
    const v = (id: string) => REFERENCE_ELECTRODES.find((r) => r.id === id)?.vsShe;
    expect(v("agcl-sat")).toBe(0.197);
    expect(v("agcl-3m")).toBe(0.21);
    expect(v("sce")).toBe(0.241);
    expect(v("hgo-koh")).toBe(0.098);
    expect(v("she")).toBe(0);
  });
});

describe("guides", () => {
  const entries = Object.entries(GUIDES);

  it.each(entries)("%s answers first and fits a search result", (_slug, g) => {
    expect(g.title.length).toBeLessThanOrEqual(52);
    expect(g.description.length).toBeLessThanOrEqual(160);
    expect(g.answer.split(/\s+/).length).toBeGreaterThanOrEqual(25);
    expect(g.sections.length).toBeGreaterThanOrEqual(3);
    expect(g.faqs.length).toBeGreaterThanOrEqual(2);
    expect(g.sections.some((s) => s.table)).toBe(true);
  });

  it.each(entries)("%s links only to pages that exist", (_slug, g) => {
    for (const { href } of g.links) {
      if (href.startsWith("/shop/c/")) expect(CATEGORY_SEO[href.slice(8)], href).toBeDefined();
      if (href.startsWith("/guides/")) expect(GUIDES[href.slice(8)], href).toBeDefined();
    }
  });

  it("are linked from the categories they discuss", () => {
    expect(guidesForCategory("reference-electrodes").map((l) => l.href)).toContain("/guides/reference-electrode-comparison");
    expect(guidesForCategory("h-cell").map((l) => l.href)).toContain("/guides/h-cell-vs-flow-cell");
  });

  it("are in the sitemap, the footer and llms.txt", () => {
    expect(src("frontend/lib/sitemap.ts")).toMatch(/Object\.keys\(GUIDES\)/);
    expect(src("frontend/lib/sitemap.ts")).toContain('"/tools/potential-converter"');
    expect(src("frontend/lib/site.ts")).toContain(`href: "/guides"`);
    expect(src("frontend/components/layout/site-footer.tsx")).toContain("footerResources");
    expect(src("app/llms.txt/route.ts")).toMatch(/Object\.entries\(GUIDES\)/);
  });

  it("answer an unknown guide with a real 404", () => {
    const page = src("app/guides/[slug]/page.tsx");
    expect(page).toMatch(/Object\.hasOwn\(GUIDES, slug\)/);
    expect(page.match(/notFound\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
