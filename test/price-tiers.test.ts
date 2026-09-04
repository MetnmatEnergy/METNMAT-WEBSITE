import { describe, it, expect } from "vitest";
import { unitPriceForQty } from "../apps/website/src/frontend/lib/catalog";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

/**
 * What a customer is actually charged for a bulk quantity.
 *
 * `unitPriceForQty` is the single function behind BOTH the tier table printed on
 * the product page and the amount `create-order/route.ts` charges and snapshots
 * onto the order and the GST invoice. A defect here is not cosmetic: it is the
 * difference between the price on the page and the price on the card.
 *
 * TWO DEFECTS, verified against the real module before either was touched.
 *
 * 1. ORDER-DEPENDENCE. The loop keeps the LAST tier in array order that the
 *    quantity qualifies for, not the deepest break. Payload array rows are
 *    drag-reorderable and staff naturally write a price list deepest-first
 *    ("100+ = 1450, 25+ = 1650"), so the row that wins depends on typing order.
 *    The page prints one number and the checkout charges another.
 *
 * 2. UNBOUNDED TIER PRICE. `minQty`/`price` carry no min, no max and no
 *    validate. `required: true` does not exclude 0, because payload's number
 *    validator tests `!value && !isNumber(value)` and isNumber(0) is true. A
 *    negative tier price flows straight through to lineTotal.
 *
 * These tests were written to FAIL against the code as it stood.
 */

const base = (over: Partial<Product> = {}): Product =>
  ({
    slug: "pump",
    name: "Pump",
    price: 1800,
    moq: 1,
    priceTiers: [],
    productType: "in-stock",
    ...over,
  }) as unknown as Product;

describe("the deepest qualifying break wins, whatever order the rows are in", () => {
  const deepestFirst = base({
    priceTiers: [
      { minQty: 100, price: 1450 },
      { minQty: 25, price: 1650 },
    ],
  } as Partial<Product>);

  const shallowestFirst = base({
    priceTiers: [
      { minQty: 25, price: 1650 },
      { minQty: 100, price: 1450 },
    ],
  } as Partial<Product>);

  it("charges the 100+ break at qty 200 when rows are written deepest-first", () => {
    // The failing case. Before the fix this returned 1650 — the shallower break —
    // while the tier table on the same page printed "100+ ₹1,450".
    expect(unitPriceForQty(deepestFirst, 200)).toBe(1450);
  });

  it("charges the same at qty 200 when rows are written shallowest-first", () => {
    expect(unitPriceForQty(shallowestFirst, 200)).toBe(1450);
  });

  it("is order-independent — the two orderings agree at every quantity", () => {
    // The invariant, rather than two examples of it.
    for (const qty of [1, 24, 25, 26, 99, 100, 101, 500]) {
      expect(unitPriceForQty(deepestFirst, qty)).toBe(unitPriceForQty(shallowestFirst, qty));
    }
  });

  it("still uses the shallower break below the deeper threshold", () => {
    expect(unitPriceForQty(deepestFirst, 50)).toBe(1650);
  });

  it("falls back to the base price below every break", () => {
    expect(unitPriceForQty(deepestFirst, 5)).toBe(1800);
  });

  it("takes the break exactly at its minQty, not one above", () => {
    expect(unitPriceForQty(deepestFirst, 25)).toBe(1650);
    expect(unitPriceForQty(deepestFirst, 100)).toBe(1450);
  });
});

describe("a malformed tier can never reduce what is charged", () => {
  it("ignores a NEGATIVE tier price rather than charging it", () => {
    // The severe case: -1000 flowed into lineTotal. A single-line cart made
    // Razorpay reject a negative amount; a mixed cart stayed positive and simply
    // charged that much less, producing a real paid order at an arbitrary
    // discount.
    const p = base({ priceTiers: [{ minQty: 25, price: -1000 }] } as Partial<Product>);
    expect(unitPriceForQty(p, 50)).toBe(1800);
  });

  it("ignores a zero tier price", () => {
    const p = base({ priceTiers: [{ minQty: 25, price: 0 }] } as Partial<Product>);
    expect(unitPriceForQty(p, 50)).toBe(1800);
  });

  it("ignores a non-finite tier price", () => {
    const p = base({
      priceTiers: [
        { minQty: 25, price: Number.NaN },
        { minQty: 30, price: Infinity },
      ],
    } as Partial<Product>);
    expect(unitPriceForQty(p, 50)).toBe(1800);
  });

  it("ignores a tier whose minQty is missing or nonsensical", () => {
    const p = base({
      priceTiers: [
        { minQty: 0, price: 900 },
        { minQty: -5, price: 800 },
      ],
    } as Partial<Product>);
    // A break at qty 0 would apply to every order, silently repricing the whole
    // catalogue entry.
    expect(unitPriceForQty(p, 1)).toBe(1800);
  });

  it("a good tier still applies when a bad one sits beside it", () => {
    const p = base({
      priceTiers: [
        { minQty: 25, price: -1000 },
        { minQty: 50, price: 1500 },
      ],
    } as Partial<Product>);
    expect(unitPriceForQty(p, 60)).toBe(1500);
  });

  it("ignores a tier ABOVE the base price — buying more must never cost more", () => {
    /*
     * The validator refuses this at save time, so it cannot be entered today.
     * This is the other layer, and it is the one that matters for rows written
     * BEFORE that validator existed: the pricer must never charge more than the
     * base price because of a bulk break.
     */
    const p = base({ priceTiers: [{ minQty: 25, price: 2500 }] } as Partial<Product>);
    expect(unitPriceForQty(p, 50)).toBe(1800);
  });

  it("still honours a legitimate discount sitting beside an above-base row", () => {
    const p = base({
      priceTiers: [
        { minQty: 25, price: 2500 },
        { minQty: 50, price: 1500 },
      ],
    } as Partial<Product>);
    expect(unitPriceForQty(p, 60)).toBe(1500);
  });

  it("survives a missing tiers array entirely", () => {
    const p = base({ priceTiers: undefined } as unknown as Partial<Product>);
    expect(unitPriceForQty(p, 50)).toBe(1800);
  });
});
