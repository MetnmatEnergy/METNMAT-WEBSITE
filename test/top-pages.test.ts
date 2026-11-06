import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { PRODUCT_NOTES, productNotes } from "../apps/website/src/frontend/lib/product-notes";
import { SERVICE_PAGES, serviceForPost, servicePageLinks } from "../apps/website/src/frontend/lib/service-pages";
import { SERVICE_DETAILS } from "../apps/website/src/frontend/lib/service-details";
import { changesWithShop } from "../apps/website/src/frontend/lib/sitemap-dates";

const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");
const notes = Object.entries(PRODUCT_NOTES);

describe("product notes", () => {
  it("covers the 30 most searched products", () => {
    expect(notes).toHaveLength(30);
  });

  it.each(notes)("%s says something of its own", (_slug, [use, choose]) => {
    expect(use.split(/\s+/).length).toBeGreaterThanOrEqual(25);
    expect(choose.split(/\s+/).length).toBeGreaterThanOrEqual(25);
  });

  it("repeats no paragraph", () => {
    const all = notes.flatMap(([, n]) => n);
    expect(new Set(all).size).toBe(all.length);
  });

  it("makes no claim the catalogue does not", () => {
    const text = JSON.stringify(PRODUCT_NOTES);
    expect(text).not.toMatch(/nafion/i);
    expect(text).not.toMatch(/₹|\bINR\b|\bRs\b/);
    expect(text).not.toMatch(/\b(we|METNMAT) (make|makes|manufacture|manufactures)\b/i);
    expect(text).not.toMatch(/made in India|in stock|ships in|certified|ISO\b/i);
  });

  it("does not resolve inherited names, and is shown on the page", () => {
    expect(productNotes("constructor")).toBeUndefined();
    expect(src("app/shop/p/[slug]/page.tsx")).toContain("productNotes(product.slug)");
  });
});

describe("service pages", () => {
  const pages = Object.entries(SERVICE_PAGES);

  it.each(pages)("%s fits a search result and answers first", (_slug, s) => {
    expect(s.title.length).toBeLessThanOrEqual(52);
    expect(s.description.length).toBeLessThanOrEqual(160);
    expect(s.answer.split(/\s+/).length).toBeGreaterThanOrEqual(25);
    expect(s.faqs.length).toBeGreaterThanOrEqual(3);
    expect(s.sections.some((x) => x.table)).toBe(true);
  });

  it("claims no accreditation, standard, turnaround or price", () => {
    const text = JSON.stringify(SERVICE_PAGES);
    expect(text).not.toMatch(/NABL|ISO\b|ASTM|accredit|certif|within \d|\d+ (days|hours)|₹/i);
  });

  it("names only techniques the site already publishes", () => {
    const published = JSON.stringify(SERVICE_DETAILS);
    for (const t of ["SEM", "XRD", "EDS", "DSC/TGA", "OES/XRF", "Tensile", "Fractography", "Inclusion cleanliness"]) {
      expect(published, t).toContain(t);
    }
  });

  it("gets its 404 from generateMetadata, because dynamicParams = false breaks on revalidation", () => {
    const page = src("app/services/[slug]/page.tsx");
    expect(page).not.toMatch(/export const dynamicParams/);
    expect(page).toMatch(/generateMetadata[\s\S]*if \(!page\) notFound\(\);/);
  });

  it("keeps the loading state away from these pages", () => {
    expect(() => src("app/services/loading.tsx")).toThrow();
    expect(src("app/services/(index)/loading.tsx")).toContain("SkeletonGridPage");
  });

  it("is reached from the sitemap, the footer, /services and the posts on the subject", () => {
    expect(src("frontend/lib/sitemap.ts")).toContain("Object.keys(SERVICE_PAGES)");
    expect(changesWithShop("/services/microstructure-analysis")).toBe(true);
    expect(changesWithShop("/services")).toBe(false);
    expect(src("frontend/lib/site.ts")).toContain('href: "/services/metallurgical-testing"');
    expect(src("app/services/(index)/page.tsx")).toContain("servicePageLinks()");
    expect(servicePageLinks()).toHaveLength(pages.length);
    expect(serviceForPost("metallurgical-testing-in-quality-control-and-assurance")?.href).toBe("/services/metallurgical-testing");
    expect(serviceForPost("defect-and-microstructure-analysis-by-diffraction")?.href).toBe("/services/microstructure-analysis");
    expect(serviceForPost("no-such-post")).toBeUndefined();
  });
});
