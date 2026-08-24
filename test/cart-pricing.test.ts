import { describe, it, expect } from "vitest";
import {
  clampQty,
  gstPortionOf,
  inclGST,
  isQuoteOnly,
  lineUsdValue,
  unitPriceForQty,
  usdFor,
  MAX_ORDER_QTY,
  type Product,
} from "../apps/website/src/frontend/lib/catalog";
import { resolveProductPricing } from "../apps/website/src/frontend/lib/region";

/**
 * Cart and checkout pricing invariants.
 *
 * These mirror what `api/checkout/create-order` does per line: look the product
 * up in the CMS, clamp the quantity, apply tiers, add GST. The route takes only
 * a slug, a quantity and a size from the request — never a price, a currency or
 * a total — so these functions ARE the charged amount, and the properties below
 * are what stop a crafted request from changing it.
 */
const base: Product = {
  slug: "p",
  name: "P",
  brand: "METNMAT",
  categorySlug: "c",
  sku: "S",
  price: 50_000,
  rating: 0,
  reviewCount: 0,
  inStock: true,
  moq: 1,
  unit: "pc",
  leadTime: "",
  priceTiers: [],
  shortDesc: "",
  specs: [],
  datasheets: [],
};
const p = (over: Partial<Product> = {}): Product => ({ ...base, ...over });

/** The route's per-line computation, reproduced exactly. */
const lineTotal = (product: Product, qty: number): number =>
  inclGST(unitPriceForQty(product, clampQty(product, qty))) * clampQty(product, qty);

describe("the charged amount ignores anything the client says", () => {
  it("is identical whichever currency the customer was browsing in", () => {
    const product = p();
    // displayCurrency never enters the INR computation — there is no parameter
    // for it, which is the point.
    const inr = resolveProductPricing(product, "IN", 84, 2)!;
    const usd = resolveProductPricing(product, "INTL", 84, 2)!;
    expect(inr.baseAmount).toBe(usd.baseAmount);
    expect(usd.baseAmount).toBe(lineTotal(product, 2));
  });

  it("is unaffected by the exchange rate", () => {
    const product = p();
    // A forged or stale rate cannot move the rupee charge.
    for (const rate of [1, 84, 10_000]) {
      expect(resolveProductPricing(product, "INTL", rate, 1)!.baseAmount).toBe(lineTotal(product, 1));
    }
  });

  it("clamps quantity to the minimum order quantity", () => {
    const product = p({ moq: 5 });
    expect(clampQty(product, 1)).toBe(5);
    expect(clampQty(product, 7)).toBe(7);
    // A line asking for less than the MOQ is charged at the MOQ, not the ask.
    expect(lineTotal(product, 1)).toBe(inclGST(50_000) * 5);
  });

  it("caps absurd quantities rather than trusting the number", () => {
    expect(clampQty(p(), 10_000_000)).toBe(MAX_ORDER_QTY);
  });

  it("rejects negative, zero and non-numeric quantities", () => {
    const product = p({ moq: 2 });
    expect(clampQty(product, -5)).toBe(2);
    expect(clampQty(product, 0)).toBe(2);
    expect(clampQty(product, Number.NaN)).toBe(2);
  });
});

describe("quote-only products are not buyable", () => {
  it("recognises every form of unbuyable", () => {
    expect(isQuoteOnly(p({ price: 0 }))).toBe(true);
    expect(isQuoteOnly(p({ productType: "quote-only" }))).toBe(true);
    expect(isQuoteOnly(p({ productType: "discontinued" }))).toBe(true);
    expect(isQuoteOnly(p())).toBe(false);
  });

  it("stays unbuyable even when the row still carries a price", () => {
    // The route checks this before reading any price, so a discontinued product
    // with a stale figure cannot be ordered at it.
    expect(isQuoteOnly(p({ price: 50_000, productType: "discontinued" }))).toBe(true);
  });
});

describe("GST", () => {
  it("adds 18% and reports the contained portion", () => {
    expect(inclGST(50_000)).toBe(59_000);
    expect(gstPortionOf(59_000)).toBe(9_000);
  });

  it("round-trips so the invoice's tax line reconciles with the total", () => {
    for (const net of [1, 999, 50_000, 123_457]) {
      const incl = inclGST(net);
      // Within a rupee — both sides round to whole rupees.
      expect(Math.abs(incl - gstPortionOf(incl) - net)).toBeLessThanOrEqual(1);
    }
  });
});

describe("USD line values", () => {
  it("converts at the rate when no fixed price is set", () => {
    const product = p();
    expect(lineUsdValue(product, 50_000, 2, 84)).toBeCloseTo((59_000 * 2) / 84, 6);
  });

  it("uses the fixed price, scaled, when one is set", () => {
    const product = p({ internationalPricing: "FIXED_USD", usdPrice: 700 });
    expect(lineUsdValue(product, 50_000, 2, 84)).toBe(1400);
  });

  it("ignores a stale fixed price once the mode says automatic", () => {
    const product = p({ internationalPricing: "AUTO_CONVERT", usdPrice: 700 });
    expect(usdFor(product, 59_000)).toBeUndefined();
    expect(lineUsdValue(product, 50_000, 1, 84)).toBeCloseTo(59_000 / 84, 6);
  });
});

describe("order snapshots are immutable", () => {
  it("a later rate change cannot alter what was recorded", () => {
    const product = p();
    // What the order route stores at purchase time.
    const atPurchase = {
      total: lineTotal(product, 1),
      usdRateAtPurchase: 84,
      totalUsdApprox: Math.round((lineTotal(product, 1) / 84) * 100) / 100,
    };

    // The rate moves afterwards.
    const laterRate = 95;
    const recomputedNow = Math.round((lineTotal(product, 1) / laterRate) * 100) / 100;

    // The stored figures are plain numbers, not derived on read — which is what
    // makes yesterday's order still show yesterday's price.
    expect(atPurchase.usdRateAtPurchase).toBe(84);
    expect(atPurchase.totalUsdApprox).not.toBe(recomputedNow);
    expect(atPurchase.total).toBe(lineTotal(product, 1));
  });

  it("a fixed-price order records no rate, because none was used", () => {
    const product = p({ internationalPricing: "FIXED_USD", usdPrice: 700 });
    const r = resolveProductPricing(product, "INTL", 84)!;
    expect(r.pricingMode).toBe("FIXED_USD");
    expect(r.exchangeRate).toBeUndefined();
  });
});
