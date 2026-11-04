import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { CATEGORY_SEO, categoryMetaDescription } from "../apps/website/src/frontend/lib/category-seo";
import { TOPIC_SEO, topicProducts, topicsForCategory } from "../apps/website/src/frontend/lib/topic-seo";
import { productSearchDescription } from "../apps/website/src/frontend/lib/seo";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

const product = (p: Partial<Product>) =>
  ({ slug: "x", name: "X", categorySlug: "counter-electrodes", price: 1000, gstRate: 18, ...p }) as unknown as Product;
const entries = Object.entries(TOPIC_SEO);
const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");

describe("topic pages", () => {
  it.each(entries)("%s fits a search result and links to real categories", (_slug, t) => {
    expect(t.title.length).toBeLessThanOrEqual(52);
    const worst = categoryMetaDescription(t, Array.from({ length: 22 }, () => product({ price: 847458 })));
    expect(worst.length).toBeLessThanOrEqual(165);
    expect(CATEGORY_SEO[t.parent], t.parent).toBeDefined();
    for (const r of t.related) expect(CATEGORY_SEO[r], r).toBeDefined();
    expect(t.intro.split(/\s+/).length).toBeGreaterThanOrEqual(30);
    expect(t.faqs.length).toBeGreaterThanOrEqual(2);
  });

  it("has its own title and heading, distinct from the categories", () => {
    const all = [...entries.map(([, t]) => t), ...Object.values(CATEGORY_SEO)];
    expect(new Set(all.map((s) => s.title)).size).toBe(all.length);
    expect(new Set(all.map((s) => s.h1)).size).toBe(all.length);
  });

  it("writes no prices by hand", () => {
    for (const [slug, t] of entries) expect(JSON.stringify({ ...t, matches: undefined }), slug).not.toMatch(/₹/);
  });

  it("selects by what the product is, and only in the right categories", () => {
    const pt = TOPIC_SEO["platinum-electrodes"];
    expect(pt.matches(product({ name: "Platinum Mesh Counter Electrode (30 × 30 mm)" }))).toBe(true);
    expect(pt.matches(product({ name: "Noble metal plate platinum 20 × 20 × 0.1mm" }))).toBe(true);
    // A holder with a platinum contact is not a platinum electrode.
    expect(pt.matches(product({ name: "PTFE Replaceable Platinum Electrode Holder", categorySlug: "electrode-holders" }))).toBe(false);
    expect(pt.matches(product({ name: "Graphite Rod Counter Electrode" }))).toBe(false);

    const ag = TOPIC_SEO["ag-agcl-reference-electrodes"];
    expect(ag.matches(product({ name: "Ag/AgCl Reference Electrode (PEEK Rod)", categorySlug: "reference-electrodes" }))).toBe(true);
    expect(ag.matches(product({ name: "Saturated Calomel Electrode Hg/Hg2Cl2", categorySlug: "reference-electrodes" }))).toBe(false);
  });

  it("lists the cheapest first and products without a price last", () => {
    const list = [
      product({ slug: "none", name: "Platinum A", price: 0 }),
      product({ slug: "dear", name: "Platinum B", price: 5000 }),
      product({ slug: "cheap", name: "Platinum C", price: 1000 }),
    ];
    expect(topicProducts(TOPIC_SEO["platinum-electrodes"], list).map((p) => p.slug)).toEqual(["cheap", "dear", "none"]);
  });

  it("is linked from its category and listed in the sitemap, so crawlers can reach it", () => {
    expect(topicsForCategory("counter-electrodes").map((l) => l.href)).toContain("/shop/t/platinum-electrodes");
    expect(src("frontend/lib/sitemap.ts")).toMatch(/Object\.keys\(TOPIC_SEO\)\.map\(\(t\) => `\/shop\/t\/\$\{t\}`\)/);
  });

  it("answers an unknown topic with a real 404, and resolves only its own keys", () => {
    const page = src("app/shop/t/[topic]/page.tsx");
    expect(page).toMatch(/Object\.hasOwn\(TOPIC_SEO, slug\)/);
    expect(page.match(/notFound\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("product search description", () => {
  const p = { metaDescription: "Hg/HgO reference electrode for alkaline electrolytes." };

  it("leads with the live price", () => {
    expect(productSearchDescription(p, 23600)).toBe(
      "₹23,600 incl. GST, free shipping in India. Hg/HgO reference electrode for alkaline electrolytes.",
    );
  });

  it("claims no price for a product without one", () => {
    expect(productSearchDescription(p, undefined)).toBe(p.metaDescription);
  });

  it("stays inside the length Google shows", () => {
    expect(productSearchDescription({ metaDescription: "x ".repeat(120) }, 23600).length).toBeLessThanOrEqual(155);
  });
});

describe("product page", () => {
  const page = src("app/shop/p/[slug]/page.tsx");

  it("hides the SKU label when a product has none", () => {
    expect(page).toMatch(/\{product\.sku && <span[^>]*>SKU: \{product\.sku\}<\/span>\}/);
  });

  it("marks up the family FAQs only because they are shown on the page", () => {
    expect(page).toMatch(/\.\.\.productFaqs\(product\),\s+\.\.\.\(familySeo\?\.faqs \?\? \[\]\),/);
    expect(page).toMatch(/\{faqs\.map\(\(f\) => \(/);
  });
});
