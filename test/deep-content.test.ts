import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PRODUCT_COPY, productCopy, siblingProducts } from "../apps/website/src/frontend/lib/product-copy";
import { productSearchTerms } from "../apps/website/src/frontend/lib/product-terms";
import { GUIDES, guidesForCategory } from "../apps/website/src/frontend/lib/guides";
import { CATEGORY_SEO } from "../apps/website/src/frontend/lib/category-seo";
import {
  ELECTRODE_FAMILIES,
  NERNST_SLOPE,
  REFERENCE_ELECTRODES,
  conversionTerms,
  convert,
  electrodeById,
  parseNumber,
  phWarning,
  rulerTicks,
  rulerWindow,
  volts,
} from "../apps/website/src/frontend/lib/potential-convert";
import catalogue from "./fixtures/catalogue-2026-11-04.json";

const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");
const usualWindow = () => rulerWindow([1.5, 0.098, -0.83]);

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
  const ref = electrodeById;

  it("adds the reference potential for SHE", () => {
    expect(convert(0.5, ref("agcl-sat"), ref("she"), 7)).toBeCloseTo(0.697, 6);
  });

  it("adds the pH term for RHE", () => {
    // Hg/HgO in 1 M KOH at pH 14: 1.000 + 0.098 + 0.8288.
    expect(convert(1, ref("hgo-koh"), ref("rhe"), 14)).toBeCloseTo(1.9268, 4);
    expect(convert(0, ref("she"), ref("rhe"), 0)).toBe(0);
  });

  it("converts between two references, whatever the pH", () => {
    expect(convert(0.3, ref("sce"), ref("agcl-sat"), 3)).toBeCloseTo(0.344, 6);
    expect(convert(0.3, ref("sce"), ref("agcl-sat"), 13)).toBeCloseTo(0.344, 6);
  });

  it("runs backwards, from a target vs RHE to what to set", () => {
    // 1.6 V vs RHE at pH 14 is 1.6 − 0.098 − 0.8288 against Hg/HgO.
    expect(convert(1.6, ref("rhe"), ref("hgo-koh"), 14)).toBeCloseTo(0.6732, 4);
    for (const r of REFERENCE_ELECTRODES) {
      expect(convert(convert(0.42, r, ref("rhe"), 9), ref("rhe"), r, 9)).toBeCloseTo(0.42, 9);
    }
  });

  it("holds the checked values", () => {
    const v = (id: string) => REFERENCE_ELECTRODES.find((r) => r.id === id)?.vsShe;
    expect(v("agcl-sat")).toBe(0.197);
    expect(v("agcl-35m")).toBe(0.205);
    expect(v("agcl-3m")).toBe(0.21);
    expect(v("agcl-1m")).toBe(0.235);
    expect(v("sce")).toBe(0.241);
    expect(v("hgo-koh")).toBe(0.098);
    expect(v("hgo-naoh")).toBe(0.108);
    expect(v("mse")).toBe(0.64);
    expect(v("mse-h2so4")).toBe(0.68);
    expect(v("she")).toBe(0);
    expect(NERNST_SLOPE).toBe(0.0592);
  });

  it("puts Hg/HgO where labs measure it against RHE in 1 M KOH", () => {
    const gap = convert(0, ref("hgo-koh"), ref("rhe"), 14);
    expect(gap).toBeGreaterThanOrEqual(0.923);
    expect(gap).toBeLessThanOrEqual(0.927);
  });

  it("gives every electrode a family the dropdown can show", () => {
    const families = new Set(ELECTRODE_FAMILIES.map((f) => f.id));
    for (const r of REFERENCE_ELECTRODES) expect(families.has(r.family), r.id).toBe(true);
    expect(new Set(REFERENCE_ELECTRODES.map((r) => r.id)).size).toBe(REFERENCE_ELECTRODES.length);
  });

  it("shows a sum that adds up to the answer", () => {
    for (const a of REFERENCE_ELECTRODES) {
      for (const b of REFERENCE_ELECTRODES) {
        const sum = conversionTerms(0.25, a, b, 8.5).reduce((total, t) => total + t.value, 0);
        expect(sum, `${a.id} to ${b.id}`).toBeCloseTo(convert(0.25, a, b, 8.5), 9);
      }
    }
  });

  it("warns when the electrode does not belong at that pH", () => {
    expect(phWarning(ref("hgo-koh"), 2)).toMatch(/alkaline/);
    expect(phWarning(ref("hgo-koh"), 14)).toBeUndefined();
    expect(phWarning(ref("mse"), 13)).toMatch(/alkaline/);
    expect(phWarning(ref("agcl-sat"), 14)).toMatch(/strong alkali/);
    expect(phWarning(ref("agcl-sat"), 7)).toBeUndefined();
    expect(phWarning(ref("rhe"), 14)).toBeUndefined();
  });

  it("writes numbers the way a paper does", () => {
    expect(volts(1.2)).toBe("+1.200 V");
    expect(volts(-0.25)).toBe("−0.250 V");
    expect(volts(-0.0001)).toBe("0.000 V");
    expect(parseNumber("0,5")).toBe(0.5);
    expect(parseNumber("−0.2")).toBe(-0.2);
    expect(parseNumber(" ")).toBeNaN();
    expect(parseNumber("abc")).toBeNaN();
  });

  it("keeps everyday values on a ruler that does not rescale", () => {
    const usual = rulerWindow([1.5, 0.098, -0.83]);
    expect(rulerWindow([0.2, 0.68, 0])).toEqual(usual);
    expect(usual.min).toBeLessThan(-1);
    expect(usual.max).toBeGreaterThan(1.5);
  });

  it("widens the ruler for a value off the end, and numbers it from each scale's zero", () => {
    const wide = rulerWindow([12, 0.2, -0.8]);
    expect(wide.max).toBeGreaterThanOrEqual(12);
    const ticks = rulerTicks(usualWindow(), 0.098);
    expect(ticks.filter((t) => t.volts === 0)).toEqual([{ volts: 0, label: "0" }]);
    expect(ticks.find((t) => t.label === "+0.5")).toBeDefined();
    expect(ticks.find((t) => t.label === "−0.5")).toBeDefined();
  });

  it("covers the whole window even mid-slide", () => {
    const view = usualWindow();
    for (const zero of [-0.83, 0, 0.68]) {
      const ticks = rulerTicks(view, zero);
      expect(ticks[0].volts + zero).toBeLessThan(view.min);
      expect(ticks.at(-1)!.volts + zero).toBeGreaterThan(view.max);
    }
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
