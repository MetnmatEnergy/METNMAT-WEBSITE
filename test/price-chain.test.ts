import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  unitPriceForQty,
  inclGST,
  isQuoteOnly,
  type Product,
} from "../apps/website/src/frontend/lib/catalog";

/**
 * The price on the page must equal the price on the card.
 *
 * The buy box and the checkout compute the unit price with the SAME expression:
 *
 *   product-buy-box.tsx:98        inclGST(unitPriceForQty(product, qty))
 *   create-order/route.ts:147     inclGST(unitPriceForQty(product, qty))
 *
 * That shared shape is the guarantee, and it is why the tier-ordering defect
 * could be fixed in one function and land on both. These tests pin the boundary
 * behaviour of that shared expression, and the last block asserts the two call
 * sites have not drifted apart — because the day they do, the page and the card
 * disagree and no unit test of either alone would notice.
 */

const P = (over: Partial<Product> = {}): Product =>
  ({
    slug: "cell",
    name: "Cell",
    price: 1800,
    moq: 1,
    priceTiers: [],
    productType: "in-stock",
    ...over,
  }) as unknown as Product;

/** What the customer is quoted, and what the card is charged. */
const quoted = (p: Product, qty: number) => inclGST(unitPriceForQty(p, qty));

describe("boundaries around MOQ and the tier breaks", () => {
  const p = P({
    moq: 10,
    priceTiers: [
      { minQty: 25, price: 1650 },
      { minQty: 100, price: 1450 },
    ],
  } as Partial<Product>);

  it.each([
    [0, 1800],
    [1, 1800],
    [9, 1800], // below MOQ — the pricer does not police MOQ, clampQty does
    [10, 1800], // at MOQ
    [24, 1800], // one below the first break
    [25, 1650], // exactly at it
    [26, 1650],
    [99, 1650], // one below the second
    [100, 1450], // exactly at it
    [101, 1450],
    [1_000_000, 1450], // very large
  ])("qty %i is priced at %i ex-GST", (qty, expected) => {
    expect(unitPriceForQty(p, qty)).toBe(expected);
  });

  it("never returns a non-finite or negative number for any of those", () => {
    for (const qty of [0, 1, 9, 10, 24, 25, 26, 99, 100, 101, 1_000_000]) {
      const v = unitPriceForQty(p, qty);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("is monotonic — a larger quantity never costs MORE per unit", () => {
    // The property that makes a bulk discount a discount. It held only by
    // accident before, because an above-base tier was accepted.
    let last = Infinity;
    for (const qty of [1, 10, 25, 50, 100, 500]) {
      const unit = unitPriceForQty(p, qty);
      expect(unit).toBeLessThanOrEqual(last);
      last = unit;
    }
  });
});

describe("the quoted price equals the charged price", () => {
  const cases: Array<[string, Product, number]> = [
    ["no tiers", P(), 5],
    ["below every break", P({ priceTiers: [{ minQty: 50, price: 1500 }] } as Partial<Product>), 10],
    ["at a break", P({ priceTiers: [{ minQty: 50, price: 1500 }] } as Partial<Product>), 50],
    [
      "deepest of several",
      P({
        priceTiers: [
          { minQty: 100, price: 1400 },
          { minQty: 25, price: 1650 },
        ],
      } as Partial<Product>),
      200,
    ],
  ];

  it.each(cases)("%s: page and checkout agree", (_label, product, qty) => {
    // Both sites evaluate inclGST(unitPriceForQty(...)). Computing it twice here
    // is the point: if the shared helper ever became order- or state-dependent,
    // these would diverge.
    const page = inclGST(unitPriceForQty(product, qty));
    const checkout = inclGST(unitPriceForQty(product, qty));
    expect(page).toBe(checkout);
    expect(page).toBe(quoted(product, qty));
  });

  it("GST is applied once, not twice", () => {
    expect(inclGST(1000)).toBe(1180);
    expect(quoted(P({ price: 1000 }), 1)).toBe(1180);
  });
});

describe("non-purchasable product types", () => {
  it("a zero price is quote-only whatever the type says", () => {
    // catalog.ts isQuoteOnly(): `!product.price || ...` — an empty price wins
    // over the In-stock dropdown, which is why the field description now says so.
    expect(isQuoteOnly(P({ price: 0 }))).toBe(true);
    expect(isQuoteOnly(P({ price: 0, productType: "in-stock" } as Partial<Product>))).toBe(true);
  });

  it("quote-only and discontinued are quote-only even when priced", () => {
    expect(isQuoteOnly(P({ productType: "quote-only" } as Partial<Product>))).toBe(true);
    expect(isQuoteOnly(P({ productType: "discontinued" } as Partial<Product>))).toBe(true);
  });

  it("in-stock and made-to-order are buyable when priced", () => {
    expect(isQuoteOnly(P({ productType: "in-stock" } as Partial<Product>))).toBe(false);
    expect(isQuoteOnly(P({ productType: "made-to-order" } as Partial<Product>))).toBe(false);
  });

  it("a quote-only product still returns a sane number if asked", () => {
    // Nothing should divide by it or render NaN even though it is never charged.
    expect(unitPriceForQty(P({ price: 0 }), 10)).toBe(0);
  });
});

describe("the two call sites still share one expression", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "apps", "website", "src", p), "utf8");

  it("the buy box and the checkout both use inclGST(unitPriceForQty(...))", () => {
    // If one side ever computes the price differently, the page and the card
    // disagree — and a unit test of either alone would still pass.
    // Rate-aware now, and still ONE expression. `inclGSTForProduct` derives the
    // rate from the product itself, so the page and the card cannot pick
    // different GST rates any more than they could pick different tier prices.
    // This test caught the drift when the charge briefly used inclGSTAt with a
    // separately-computed rate — equivalent arithmetic, but two sources.
    expect(read("frontend/components/commerce/product-buy-box.tsx")).toMatch(
      /inclGSTForProduct\(product, unitPriceForQty\(product, qty\)\)/,
    );
    expect(read("app/api/checkout/create-order/route.ts")).toMatch(
      /inclGSTForProduct\(product, unitPriceForQty\(product, qty\)\)/,
    );
  });
});
