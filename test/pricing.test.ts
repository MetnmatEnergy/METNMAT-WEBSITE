import { describe, it, expect } from "vitest";
import {
  resolveProductPricing,
  currencyForRegion,
  regionForCountry,
  regionFromCookieHeader,
  formatCompact,
  formatUSD,
} from "../apps/website/src/frontend/lib/region";
import { pricingMode, usdFor, inclGST } from "../apps/website/src/frontend/lib/catalog";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

/**
 * Dual-currency pricing. These encode the two acceptance scenarios directly:
 * a ₹50,000 product on automatic conversion, and the same product with a fixed
 * $700 international price.
 *
 * The invariant underneath all of it: INR is what is charged. USD is a display
 * conversion, so `baseAmount` is the GST-inclusive rupee figure in every case
 * and never moves with the region.
 */
const base: Product = {
  slug: "test-product",
  name: "Test Product",
  brand: "METNMAT",
  categorySlug: "electrodes",
  sku: "MT-TEST-1",
  price: 50_000,
  rating: 0,
  reviewCount: 0,
  inStock: true,
  moq: 1,
  unit: "pc",
  leadTime: "Ships in 1–2 weeks",
  priceTiers: [],
  shortDesc: "",
  specs: [],
  datasheets: [],
};

const RATE = 84; // ₹ per $1
const p = (over: Partial<Product> = {}): Product => ({ ...base, ...over });

describe("Scenario A — AUTO_CONVERT", () => {
  const auto = p({ internationalPricing: "AUTO_CONVERT" });

  it("shows the rupee price to an Indian visitor", () => {
    const r = resolveProductPricing(auto, "IN", RATE)!;
    expect(r.currency).toBe("INR");
    // ₹50,000 + 18% GST
    expect(r.amount).toBe(59_000);
    expect(r.formattedAmount).toContain("59,000");
    expect(r.exchangeRate).toBeUndefined();
  });

  it("converts at the live rate for an international visitor", () => {
    const r = resolveProductPricing(auto, "INTL", RATE)!;
    expect(r.currency).toBe("USD");
    expect(r.amount).toBeCloseTo(59_000 / 84, 2);
    // The rate is reported precisely because it was used.
    expect(r.exchangeRate).toBe(RATE);
  });

  it("tracks the rate — a weaker rupee means fewer dollars", () => {
    const strong = resolveProductPricing(auto, "INTL", 80)!.amount;
    const weak = resolveProductPricing(auto, "INTL", 90)!.amount;
    expect(weak).toBeLessThan(strong);
  });

  it("charges INR regardless of what the visitor is shown", () => {
    expect(resolveProductPricing(auto, "INTL", RATE)!.baseAmount).toBe(59_000);
    expect(resolveProductPricing(auto, "IN", RATE)!.baseAmount).toBe(59_000);
  });
});

describe("Scenario B — FIXED_USD", () => {
  const fixed = p({ internationalPricing: "FIXED_USD", usdPrice: 700 });

  it("still shows the rupee price to an Indian visitor", () => {
    const r = resolveProductPricing(fixed, "IN", RATE)!;
    expect(r.currency).toBe("INR");
    expect(r.amount).toBe(59_000);
  });

  it("shows exactly the configured figure to an international visitor", () => {
    const r = resolveProductPricing(fixed, "INTL", RATE)!;
    expect(r.amount).toBe(700);
    expect(r.formattedAmount).toBe("$700");
  });

  it("does not move with the exchange rate, and reports no rate", () => {
    for (const rate of [70, 84, 95, 120]) {
      const r = resolveProductPricing(fixed, "INTL", rate)!;
      expect(r.amount).toBe(700);
      // Reporting a rate here would imply the price was derived from it.
      expect(r.exchangeRate).toBeUndefined();
    }
  });

  it("takes priority over conversion — the whole point of the mode", () => {
    const converted = 59_000 / RATE; // ≈ $702.38
    expect(resolveProductPricing(fixed, "INTL", RATE)!.amount).toBe(700);
    expect(resolveProductPricing(fixed, "INTL", RATE)!.amount).not.toBeCloseTo(converted, 2);
  });
});

describe("mode resolution", () => {
  it("derives FIXED_USD for rows written before the selector existed", () => {
    // No internationalPricing, but a USD figure: the old implicit encoding.
    expect(pricingMode({ usdPrice: 700 })).toBe("FIXED_USD");
  });

  it("derives AUTO_CONVERT when neither is set", () => {
    expect(pricingMode({})).toBe("AUTO_CONVERT");
    expect(pricingMode({ usdPrice: 0 })).toBe("AUTO_CONVERT");
  });

  it("lets an explicit AUTO_CONVERT override a stale stored usdPrice", () => {
    // Switching a product back to automatic must take effect immediately,
    // without also needing someone to clear the old figure.
    const stale = p({ internationalPricing: "AUTO_CONVERT", usdPrice: 700 });
    expect(usdFor(stale, 59_000)).toBeUndefined();
    expect(resolveProductPricing(stale, "INTL", RATE)!.amount).toBeCloseTo(59_000 / 84, 2);
  });
});

describe("quantity and bulk tiers", () => {
  it("scales a fixed USD price proportionally rather than multiplying a rounded unit", () => {
    const fixed = p({ internationalPricing: "FIXED_USD", usdPrice: 700 });
    expect(resolveProductPricing(fixed, "INTL", RATE, 3)!.amount).toBe(2100);
  });

  it("applies bulk tiers in both currencies", () => {
    const tiered = p({ priceTiers: [{ minQty: 10, price: 40_000 }] });
    const inr = resolveProductPricing(tiered, "IN", RATE, 10)!;
    expect(inr.amount).toBe(inclGST(40_000) * 10);

    const usd = resolveProductPricing(tiered, "INTL", RATE, 10)!;
    expect(usd.amount).toBeCloseTo((inclGST(40_000) * 10) / RATE, 2);
  });

  it("keeps a fixed USD price consistent with its tier discount", () => {
    const tiered = p({
      internationalPricing: "FIXED_USD",
      usdPrice: 700,
      priceTiers: [{ minQty: 10, price: 40_000 }],
    });
    // 10 units at the discounted rate, scaled from the $700 base unit.
    const expected = Math.round(((inclGST(40_000) * 10 * 700) / inclGST(50_000)) * 100) / 100;
    expect(resolveProductPricing(tiered, "INTL", RATE, 10)!.amount).toBe(expected);
  });
});

describe("quote-only products", () => {
  it("returns null rather than a zero price", () => {
    // A falsy amount would render as free.
    expect(resolveProductPricing(p({ price: 0 }), "IN", RATE)).toBeNull();
    expect(resolveProductPricing(p({ price: 0 }), "INTL", RATE)).toBeNull();
    expect(resolveProductPricing(p({ productType: "quote-only" }), "IN", RATE)).toBeNull();
  });
});

describe("region helpers", () => {
  it("maps country to region, defaulting to the home market", () => {
    expect(regionForCountry("IN")).toBe("IN");
    expect(regionForCountry("in")).toBe("IN");
    expect(regionForCountry("US")).toBe("INTL");
    expect(regionForCountry(null)).toBe("IN");
    expect(regionForCountry("")).toBe("IN");
  });

  it("maps region to currency", () => {
    expect(currencyForRegion("IN")).toBe("INR");
    expect(currencyForRegion("INTL")).toBe("USD");
  });

  it("reads the region cookie and rejects anything else", () => {
    expect(regionFromCookieHeader("mm-region=INTL")).toBe("INTL");
    expect(regionFromCookieHeader("a=1; mm-region=IN; b=2")).toBe("IN");
    // A forged value must not become a region.
    expect(regionFromCookieHeader("mm-region=DROP")).toBeNull();
    expect(regionFromCookieHeader("")).toBeNull();
    expect(regionFromCookieHeader(null)).toBeNull();
  });
});

describe("formatting", () => {
  it("drops cents on large USD figures", () => {
    expect(formatUSD(702.38)).toBe("$702.38");
    expect(formatUSD(1234.56)).toBe("$1,235");
  });

  it("compacts card prices", () => {
    expect(formatCompact(59_000, "INR")).toBe("₹59K");
    expect(formatCompact(700, "USD")).toBe("$700");
  });
});
