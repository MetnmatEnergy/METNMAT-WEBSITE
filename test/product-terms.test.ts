import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { alsoKnownAs, productSearchTerms } from "../apps/website/src/frontend/lib/product-terms";
import { renderMerchantFeed } from "../apps/website/src/frontend/lib/merchant-feed";
import { productFaqs, productJsonLd } from "../apps/website/src/frontend/components/seo/schema";
import { TOPIC_SEO } from "../apps/website/src/frontend/lib/topic-seo";
import type { Product } from "../apps/website/src/frontend/lib/catalog";
import catalogue from "./fixtures/catalogue-2026-11-04.json";

/**
 * Buyers search "hgo reference electrode", not "Hg/HgO Reference Electrode
 * (Ø4 × 60 mm, PEEK Rod)". The fixture is every published product on 2026-11-04.
 */
const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");
const terms = (name: string, categorySlug = "reference-electrodes") => productSearchTerms({ name, categorySlug });

describe("search terms", () => {
  it.each(catalogue.map((p) => [p.name, p] as const))("%s has the names buyers use", (_name, p) => {
    const t = productSearchTerms(p);
    expect(t.length).toBeGreaterThanOrEqual(3);
    expect(new Set(t.map((x) => x.toLowerCase())).size).toBe(t.length);
  });

  it("covers the whole catalogue", () => {
    expect(catalogue.length).toBe(141);
  });

  it("says what people actually type", () => {
    expect(terms("Hg/HgO Reference Electrode (Ø4 × 60 mm, PEEK Rod)")).toContain("HgO reference electrode");
    expect(terms("Saturated Calomel Electrode Hg/Hg2Cl2")).toContain("SCE electrode");
    expect(terms("Silver Silver Chloride Ag/AgCl Reference Electrode Ø6 × 70mm Glass Rod")).toContain("silver chloride electrode");
    expect(terms("Platinum Wire Counter Electrode (PEEK Rod)", "counter-electrodes")).toContain("Pt wire electrode");
    expect(terms("Nickel Foam Electrode (200 × 300 × 1.5 mm)", "carbon-gdl")).toContain("Ni foam");
    expect(terms("Aluminum Sheet", "accessories")).toContain("aluminium sheet");
    expect(terms("PTFE Replaceable Platinum Electrode Holder", "electrode-holders")).toContain("Teflon electrode holder");
  });

  it("files a product under the right family when names overlap", () => {
    expect(terms("PTFE Replaceable Platinum Electrode Holder", "electrode-holders")[0]).toBe("platinum electrode holder");
    expect(terms("Platinum Wire Ring Counter Electrode Ø0.5 × 100mm", "counter-electrodes")[0]).toBe("platinum ring electrode");
    expect(terms("Zero-gap Electrolyzer for Carbon Dioxide Reduction", "co2-electrolysis")[0]).toBe("zero gap CO2 electrolyzer");
    expect(terms("Graphite Felt Electrode for Electrochemical Applications", "carbon-gdl")[0]).toBe("graphite felt");
  });

  it("never gives a PFSA membrane the name Nafion", () => {
    for (const p of catalogue) expect(productSearchTerms(p).join(" "), p.name).not.toMatch(/nafion/i);
  });

  it("shows only names the product's own name does not already say", () => {
    const p = { name: "Copper Foam (200mm x 300mm)", categorySlug: "carbon-gdl" };
    expect(alsoKnownAs(p)).not.toContain("copper foam");
    expect(alsoKnownAs(p)).toContain("Cu foam");
  });

  it("still shows HgO beside Hg/HgO, the spelling people type", () => {
    expect(alsoKnownAs({ name: "Hg/HgO Reference Electrode (Ø6 × 70 mm)", categorySlug: "reference-electrodes" })).toContain("HgO reference electrode");
  });

  it("returns nothing for a product no rule knows, rather than a wrong name", () => {
    expect(terms("Something New", "somewhere-new")).toEqual([]);
  });
});

describe("where the terms go", () => {
  const page = src("app/shop/p/[slug]/page.tsx");

  it("is visible on the page, so that structured data matches it", () => {
    expect(page).toMatch(/Also known as: \{otherNames\.join\(", "\)\}/);
  });

  it("puts them in the product's structured data", () => {
    const ld = productJsonLd({ product: { name: "X", slug: "x" } as never, offerable: false, alternateNames: ["a", "b"] });
    expect(ld.alternateName).toEqual(["a", "b"]);
  });

  it("asks the price question in the buyer's words", () => {
    expect(page).toMatch(/What is the price of this \$\{searchTerms\[0\]\} in India\?/);
  });

  it("sends them to Google Shopping", () => {
    const p = {
      slug: "h", name: "Hg/HgO Reference Electrode (Ø6 × 70 mm)", brand: "METNMAT", categorySlug: "reference-electrodes", sku: "",
      price: 1000, gstRate: 18, inStock: true, moq: 1, unit: "pc", priceTiers: [], shortDesc: "An electrode.", imageFulls: ["https://x/a.webp"],
    } as unknown as Product;
    expect(renderMerchantFeed([p], [], "https://www.metnmat.com")).toContain("Also known as: HgO reference electrode");
  });

  it("makes the shop's own search understand them", () => {
    expect(src("frontend/lib/cms.ts")).toMatch(/productSearchTerms\(p\)\.join\(" "\)/);
  });
});

describe("country of origin", () => {
  const base = { name: "X", countryOfOrigin: "India" };

  it("is not claimed for another maker's product", () => {
    for (const brand of ["FUMATECH", "Versogen", "Dioxide Materials", "Kamoer"]) {
      expect(productFaqs({ ...base, brand }).map((f) => f.q)).not.toContain("Where is it made?");
    }
  });

  it("is still stated for METNMAT's own", () => {
    expect(productFaqs({ ...base, brand: "METNMAT" }).map((f) => f.q)).toContain("Where is it made?");
  });
});

describe("general searches have a landing page", () => {
  it("covers gold and nickel foam, and matches real products", () => {
    expect(TOPIC_SEO["gold-electrodes"].matches({ name: "Gold Disk Electrode, Straight Type (Ø2 mm, PTFE Rod)", categorySlug: "working-electrodes" })).toBe(true);
    expect(TOPIC_SEO["nickel-foam-and-metal-felt"].matches({ name: "Nickel Foam Electrode (200 × 300 × 1.5 mm)", categorySlug: "carbon-gdl" })).toBe(true);
    const counts = (t: string) => catalogue.filter((p) => TOPIC_SEO[t].matches(p)).length;
    expect(counts("gold-electrodes")).toBeGreaterThanOrEqual(3);
    expect(counts("nickel-foam-and-metal-felt")).toBeGreaterThanOrEqual(3);
  });

  it("states the other spellings in the intro", () => {
    expect(TOPIC_SEO["hg-hgo-reference-electrodes"].intro).toContain("HgO reference electrode");
    expect(TOPIC_SEO["ag-agcl-reference-electrodes"].intro).toContain("AgCl electrode");
  });
});
