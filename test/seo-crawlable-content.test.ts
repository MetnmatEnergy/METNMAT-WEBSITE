import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { clampDescription, pageMetadata } from "../apps/website/src/frontend/lib/seo";

/**
 * From the full crawl of 2026-11-04: what a crawler receives must hold everything
 * a visitor can reach, and what a search result shows must fit.
 */
const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");

describe("product tabs", () => {
  const tabs = src("frontend/components/commerce/product-tabs.tsx");

  it("keeps every panel in the HTML and only hides the inactive ones", () => {
    expect(tabs).not.toMatch(/\{tab === "/);
    expect(tabs).toMatch(/hidden=\{active !== t\}/);
    for (const t of ["Description", "Specifications", "Documents", "Shipping & Returns"]) {
      expect(tabs).toContain(`<Panel t="${t}" active={tab}>`);
    }
  });

  it("points each tab at its own panel", () => {
    expect(tabs).toMatch(/aria-controls=\{`\$\{tabId\(t\)\}-panel`\}/);
    expect(tabs).toMatch(/id=\{`\$\{tabId\(t\)\}-panel`\}/);
    expect(tabs).not.toContain('"product-tabpanel"');
  });

  it("shows no SKU row for a product without one", () => {
    expect(tabs).toMatch(/product\.sku \? \[\{ label: "SKU", value: product\.sku \}\] : \[\]/);
  });
});

describe("meta descriptions", () => {
  it("are cut at a word to fit a search result", () => {
    const long = "word ".repeat(80);
    const clamped = clampDescription(long);
    expect(clamped.length).toBeLessThanOrEqual(155);
    expect(clamped.endsWith("…")).toBe(true);
    expect(clamped).not.toMatch(/\bwor…$/);
  });

  it("leave a description that already fits alone", () => {
    expect(clampDescription("Fits already.")).toBe("Fits already.");
  });

  it("are clamped for every page built with pageMetadata, Open Graph included", () => {
    const m = pageMetadata({ title: "T", description: "word ".repeat(80), path: "/x" });
    expect(String(m.description).length).toBeLessThanOrEqual(155);
    expect(String(m.openGraph?.description).length).toBeLessThanOrEqual(155);
  });

  it("are clamped on blog articles, which build their own metadata", () => {
    expect(src("app/blog/[slug]/page.tsx")).toMatch(/clampDescription\(article\.metaDescription \?\? article\.excerpt\)/);
  });
});
