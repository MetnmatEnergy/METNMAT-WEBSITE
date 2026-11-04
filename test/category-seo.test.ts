import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  CATEGORY_SEO,
  categoryFaqs,
  categoryMetaDescription,
  categoryPriceFacts,
} from "../apps/website/src/frontend/lib/category-seo";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

/**
 * Category pages are the ones that can rank for what buyers search. These guard
 * what a search result shows, and that prices come from the live catalogue
 * rather than from text that goes stale.
 */
const product = (p: Partial<Product>) => ({ slug: "x", name: "X", price: 1000, gstRate: 18, ...p }) as unknown as Product;
const entries = Object.entries(CATEGORY_SEO);

describe("category landing copy", () => {
  it("covers every category that has products", () => {
    // From the live catalogue, 2026-11-04. The parents hold their sub-categories' products.
    for (const slug of [
      "electrodes", "reference-electrodes", "counter-electrodes", "working-electrodes", "electrode-holders",
      "membranes", "pem-membranes", "aem-membranes", "cem-membranes", "bipolar-membranes",
      "reactor-cell", "h-cell", "water-splitting-reactors", "co2-electrolysis", "fuel-cells", "battery-reactors",
      "photo-ec-reactors", "peristaltic-pumps", "carbon-gdl", "consumables", "equipments",
      "specialised-equipment", "mea-fabrication", "accessories",
    ]) {
      expect(CATEGORY_SEO[slug], slug).toBeDefined();
    }
  });

  it.each(entries)("%s fits a search result", (_slug, seo) => {
    // The layout adds " · METNMAT" (10 characters); Google shows about 60.
    expect(seo.title.length).toBeLessThanOrEqual(52);
    // The longest live suffix: " 22 products from ₹10,00,000 incl. GST. Free shipping in India."
    const worst = categoryMetaDescription(seo, Array.from({ length: 22 }, () => product({ price: 847458 })));
    expect(worst.length).toBeLessThanOrEqual(165);
  });

  it("gives each page its own title, heading and intro", () => {
    for (const key of ["title", "h1", "intro", "lead"] as const) {
      expect(new Set(entries.map(([, s]) => s[key])).size).toBe(entries.length);
    }
  });

  it.each(entries)("%s opens with real content and links only to categories that exist", (_slug, seo) => {
    expect(seo.intro.split(/\s+/).length).toBeGreaterThanOrEqual(30);
    expect(seo.guide.length).toBeGreaterThanOrEqual(2);
    expect(seo.keywords.length).toBeGreaterThan(0);
    for (const r of seo.related) expect(CATEGORY_SEO[r], r).toBeDefined();
  });

  it("never sells a PFSA membrane as Nafion", () => {
    // Trademark and truth: N117 is listed as a PFSA membrane, not as Nafion.
    const pem = CATEGORY_SEO["pem-membranes"];
    expect(pem.title + pem.h1 + pem.lead + pem.keywords.join(" ")).not.toMatch(/nafion/i);
    expect(pem.intro).toContain("the polymer family that Nafion® also belongs to");
  });

  it("writes no prices or product counts by hand", () => {
    for (const [slug, seo] of entries) {
      expect(JSON.stringify(seo), slug).not.toMatch(/₹|\bRs\.?\s?\d/);
    }
  });
});

describe("live price facts", () => {
  const items = [product({ price: 1000 }), product({ price: 5000 }), product({ price: 0 })];

  it("uses GST-inclusive prices and ignores products without one", () => {
    expect(categoryPriceFacts(items)).toEqual({ count: 3, min: 1180, max: 5900 });
  });

  it("states the range in the description and the first FAQ", () => {
    const seo = CATEGORY_SEO["reference-electrodes"];
    expect(categoryMetaDescription(seo, items)).toContain("3 products from ₹1,180 incl. GST.");
    const [first] = categoryFaqs(seo, items);
    expect(first.q).toBe("What is the price of reference electrodes in India?");
    expect(first.a).toContain("₹1,180 to ₹5,900 including GST");
  });

  it("claims no price when nothing in the category has one", () => {
    const seo = CATEGORY_SEO["reference-electrodes"];
    const quoteOnly = [product({ price: 0 })];
    expect(categoryMetaDescription(seo, quoteOnly)).not.toContain("from");
    expect(categoryFaqs(seo, quoteOnly)).toEqual(seo.faqs);
  });
});

describe("category page wiring", () => {
  const page = readFileSync(new URL("../apps/website/src/app/shop/c/[category]/page.tsx", import.meta.url), "utf8");

  it("keeps the landing copy off filtered and paged views, which are not indexed as landing pages", () => {
    expect(page).toMatch(/!filtersActive && page === 1 && all\.length > 0 \? CATEGORY_SEO\[category\]/);
  });

  it("emits FAQ structured data only with the visible FAQs", () => {
    expect(page).toMatch(/faqs\.length > 0 && <JsonLd data=\{faqJsonLd\(faqs\)\}/);
    expect(page).toMatch(/<CategoryGuide seo=\{seo\} faqs=\{faqs\}/);
  });

  it("gives page 2 of a category its own title and description", () => {
    const page = readFileSync(new URL("../apps/website/src/app/shop/c/[category]/page.tsx", import.meta.url), "utf8");
    expect(page).toMatch(/pageNote \? `\$\{title\}, \$\{pageNote\}` : title/);
    expect(page).toMatch(/\(pageNote \? `\$\{pageNote\}\. ` : ""\)/);
  });

  it("leaves no category thin: at least four guide points or three questions, and always a question", () => {
    for (const [slug, seo] of Object.entries(CATEGORY_SEO)) {
      expect(seo.faqs.length, slug).toBeGreaterThanOrEqual(1);
      expect(seo.guide.length + seo.faqs.length, slug).toBeGreaterThanOrEqual(4);
    }
  });
});
