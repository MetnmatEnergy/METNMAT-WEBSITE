import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  basePriceRange,
  honouredPriceTiers,
  unitPriceForQty,
  type Product,
} from "../apps/website/src/frontend/lib/catalog";

/**
 * The bulk-pricing TABLE and the price actually charged must come from one rule.
 *
 * `unitPriceForQty` was already fixed to pick the DEEPEST qualifying break and
 * to ignore rows it should never honour. The table was not: `PriceTiers` in
 * `frontend/components/commerce/price-block.tsx` mapped over
 * `product.priceTiers` in STORED ORDER and printed every row.
 *
 * Two consequences, both reachable, because `validatePriceTiers` enforces
 * bounds, MOQ and duplicate breaks but says nothing about ORDER:
 *
 *   1. Payload array rows are drag-reorderable and a price list is naturally
 *      written deepest-first ("100+ = 1450, 25+ = 1650"). Stored that way, the
 *      table's base row read `moq–(priceTiers[0].minQty - 1)` — "10–99" — while
 *      a quantity of 25 was actually charged the 1650 tier. The page
 *      contradicted itself and misstated the range the base price applies to.
 *
 *   2. The pricer skips a tier priced at or below zero, or above the base
 *      price; the table printed it anyway. Products.ts refuses to SAVE such a
 *      row now, but rows written before that validation existed still render —
 *      so the page could advertise a bulk price that would never be charged.
 *
 * The fix is one exported rule, `honouredPriceTiers`, that returns exactly the
 * tiers the pricer will honour, in ascending order. `unitPriceForQty` is
 * derived from it, so the table and the charge cannot disagree by construction
 * rather than by discipline.
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

const tiers = (t: Array<{ minQty: number; price: number }>) =>
  P({ priceTiers: t } as Partial<Product>);

describe("which tiers count, and in what order", () => {
  it("sorts ascending however they were typed in", () => {
    // The reachable case: a price list written deepest-first.
    const p = tiers([
      { minQty: 100, price: 1450 },
      { minQty: 25, price: 1650 },
    ]);
    expect(honouredPriceTiers(p).map((t) => t.minQty)).toEqual([25, 100]);
  });

  it("leaves an already-ascending list alone", () => {
    const p = tiers([
      { minQty: 25, price: 1650 },
      { minQty: 100, price: 1450 },
    ]);
    expect(honouredPriceTiers(p).map((t) => t.minQty)).toEqual([25, 100]);
  });

  it("drops a tier priced at or below zero", () => {
    // Would print as a free bulk price the checkout never honours.
    const p = tiers([
      { minQty: 25, price: 0 },
      { minQty: 50, price: -5 },
      { minQty: 100, price: 1450 },
    ]);
    expect(honouredPriceTiers(p).map((t) => t.minQty)).toEqual([100]);
  });

  it("drops a tier that costs MORE than the base price", () => {
    // Buying more must never cost more. The pricer already ignored these; the
    // table advertised them.
    const p = tiers([
      { minQty: 25, price: 2000 },
      { minQty: 100, price: 1450 },
    ]);
    expect(honouredPriceTiers(p).map((t) => t.minQty)).toEqual([100]);
  });

  it("drops a nonsensical quantity", () => {
    const p = tiers([
      { minQty: 0, price: 1500 },
      { minQty: -3, price: 1500 },
      { minQty: 25, price: 1650 },
    ]);
    expect(honouredPriceTiers(p).map((t) => t.minQty)).toEqual([25]);
  });

  it("keeps the FIRST of a duplicated break, as the pricer always did", () => {
    // validatePriceTiers refuses duplicates now, so this is legacy data only —
    // but the two must still agree about which row wins.
    const p = tiers([
      { minQty: 25, price: 1650 },
      { minQty: 25, price: 1500 },
    ]);
    expect(honouredPriceTiers(p)).toEqual([{ minQty: 25, price: 1650 }]);
  });

  it("a quote-only product keeps its tiers — there is no base to beat", () => {
    // base of 0 means the "cheaper than base" test cannot apply.
    const p = P({ price: 0, priceTiers: [{ minQty: 100, price: 1450 }] } as Partial<Product>);
    expect(honouredPriceTiers(p).map((t) => t.minQty)).toEqual([100]);
  });

  it("no tiers means no rows", () => {
    expect(honouredPriceTiers(P())).toEqual([]);
    expect(honouredPriceTiers(P({ priceTiers: undefined } as unknown as Partial<Product>))).toEqual([]);
  });
});

describe("the table and the charge cannot disagree", () => {
  /** What a customer reading the table would expect to pay at this quantity. */
  const readFromTable = (p: Product, qty: number): number => {
    const rows = honouredPriceTiers(p);
    let expected = p.price;
    for (const r of rows) if (qty >= r.minQty) expected = r.price;
    return expected;
  };

  const CASES: Array<[string, Product]> = [
    ["no tiers", P()],
    ["ascending", tiers([{ minQty: 25, price: 1650 }, { minQty: 100, price: 1450 }])],
    ["deepest-first", tiers([{ minQty: 100, price: 1450 }, { minQty: 25, price: 1650 }])],
    ["with a rejected zero row", tiers([{ minQty: 10, price: 0 }, { minQty: 25, price: 1650 }])],
    ["with a row above base", tiers([{ minQty: 10, price: 9999 }, { minQty: 25, price: 1650 }])],
    ["single deep tier", tiers([{ minQty: 500, price: 1200 }])],
    ["MOQ product", P({ moq: 10, priceTiers: [{ minQty: 25, price: 1650 }] } as Partial<Product>)],
  ];

  it.each(CASES)("%s: every quantity reads the same both ways", (_label, product) => {
    for (const qty of [0, 1, 9, 10, 24, 25, 26, 99, 100, 101, 499, 500, 10_000]) {
      expect(readFromTable(product, qty), `qty ${qty}`).toBe(unitPriceForQty(product, qty));
    }
  });

  it("the boundary quantities land on the right side", () => {
    const p = tiers([{ minQty: 100, price: 1450 }, { minQty: 25, price: 1650 }]);
    expect(unitPriceForQty(p, 24)).toBe(1800);
    expect(unitPriceForQty(p, 25)).toBe(1650);
    expect(unitPriceForQty(p, 99)).toBe(1650);
    expect(unitPriceForQty(p, 100)).toBe(1450);
    expect(unitPriceForQty(p, 1_000_000)).toBe(1450);
  });

  it("the base row's range ends one below the LOWEST honoured break", () => {
    // The defect in one assertion: with tiers stored deepest-first the old
    // table said the base price ran to 99, when it actually ran to 24.
    const p = P({
      moq: 10,
      priceTiers: [{ minQty: 100, price: 1450 }, { minQty: 25, price: 1650 }],
    } as Partial<Product>);
    const lowest = honouredPriceTiers(p)[0]?.minQty;
    expect(lowest).toBe(25);
    expect(unitPriceForQty(p, lowest! - 1)).toBe(p.price);
    expect(unitPriceForQty(p, lowest!)).not.toBe(p.price);
  });
});

/**
 * The base row must not advertise a price no order can be charged.
 *
 * `validatePriceTiers` refuses a break at or below the MOQ, because then every
 * possible order gets the tier and the base price never applies — its comment
 * says the page would print "an inverted range ('10–1 pc') that reads as a
 * rendering glitch". But that guard is gated on `moq > 1` (price-tiers.ts:48),
 * and the CMS default MOQ is 1 (Products.ts:342). So a product with MOQ 1 and a
 * tier starting at quantity 1 saves cleanly, and the table printed "1–0 unit"
 * beside a base price the checkout would never charge.
 *
 * Sorting alone did not fix this — the row is computed from the LOWEST break,
 * and the lowest break is the problem. The base row is now omitted whenever the
 * range it would describe is empty.
 */
describe("the base row is omitted when the base price is unreachable", () => {
  it("MOQ 1 with a tier starting at 1 prints no base row", () => {
    // The reachable case validatePriceTiers does not cover.
    const p = P({ price: 1000, moq: 1, priceTiers: [{ minQty: 1, price: 900 }] } as Partial<Product>);
    expect(basePriceRange(p)).toBeNull();
    // And the pricer agrees the base is never charged.
    expect(unitPriceForQty(p, 1)).toBe(900);
  });

  it("a break at exactly the MOQ prints no base row", () => {
    const p = P({ price: 1800, moq: 10, priceTiers: [{ minQty: 10, price: 1650 }] } as Partial<Product>);
    expect(basePriceRange(p)).toBeNull();
    expect(unitPriceForQty(p, 10)).toBe(1650);
  });

  it("a break below the MOQ prints no base row either", () => {
    const p = P({ price: 1800, moq: 25, priceTiers: [{ minQty: 10, price: 1650 }] } as Partial<Product>);
    expect(basePriceRange(p)).toBeNull();
  });

  it("an ordinary product still gets its base range", () => {
    const p = P({ price: 1800, moq: 10, priceTiers: [{ minQty: 25, price: 1650 }] } as Partial<Product>);
    expect(basePriceRange(p)).toEqual({ from: 10, to: 24 });
  });

  it("a single-unit range is still a real range", () => {
    const p = P({ price: 1000, moq: 1, priceTiers: [{ minQty: 2, price: 900 }] } as Partial<Product>);
    expect(basePriceRange(p)).toEqual({ from: 1, to: 1 });
  });

  it("the range is taken from the lowest HONOURED break, not the stored first", () => {
    const p = P({
      price: 1800,
      moq: 10,
      priceTiers: [
        { minQty: 100, price: 1450 },
        { minQty: 25, price: 1650 },
      ],
    } as Partial<Product>);
    expect(basePriceRange(p)).toEqual({ from: 10, to: 24 });
  });

  it("a rejected tier does not shorten the base range", () => {
    // A row priced above base is ignored by the pricer, so it must not decide
    // where the base price stops applying either.
    const p = P({
      price: 1800,
      moq: 10,
      priceTiers: [
        { minQty: 15, price: 9999 },
        { minQty: 25, price: 1650 },
      ],
    } as Partial<Product>);
    expect(basePriceRange(p)).toEqual({ from: 10, to: 24 });
  });

  it("a nonsensical MOQ falls back to 1 rather than producing a negative range", () => {
    const p = P({ price: 1800, moq: 0, priceTiers: [{ minQty: 25, price: 1650 }] } as Partial<Product>);
    expect(basePriceRange(p)).toEqual({ from: 1, to: 24 });
  });

  it("whatever the range says, the pricer agrees at both its ends", () => {
    const p = P({ price: 1800, moq: 10, priceTiers: [{ minQty: 25, price: 1650 }] } as Partial<Product>);
    const r = basePriceRange(p)!;
    expect(unitPriceForQty(p, r.from)).toBe(1800);
    expect(unitPriceForQty(p, r.to)).toBe(1800);
    expect(unitPriceForQty(p, r.to + 1)).toBe(1650);
  });
});

describe("the table is wired to the shared rule", () => {
  const src = readFileSync(
    join(
      __dirname,
      "..",
      "apps",
      "website",
      "src",
      "frontend",
      "components",
      "commerce",
      "price-block.tsx",
    ),
    "utf8",
  );

  it("renders the honoured tiers rather than the raw array", () => {
    expect(src).toMatch(/honouredPriceTiers\(product\)/);
  });

  it("no longer maps over product.priceTiers directly", () => {
    // The exact expression that produced the out-of-order table.
    expect(src).not.toMatch(/product\.priceTiers\.map/);
  });

  it("no longer takes the base range from the raw first row", () => {
    expect(src).not.toMatch(/product\.priceTiers\[0\]/);
  });

  it("asks basePriceRange rather than computing the range inline", () => {
    expect(src).toMatch(/basePriceRange\(product\)/);
  });

  it("omits the base row entirely when there is no range", () => {
    expect(src).toMatch(/baseRange \?/);
  });

  it("still hides the table when there is nothing to show", () => {
    expect(src).toMatch(/if \(!rows\.length\) return null|rows\.length === 0/);
  });
});

describe("the two call sites still share one expression", () => {
  const read = (p: string) =>
    readFileSync(join(__dirname, "..", "apps", "website", "src", p), "utf8");

  it("the buy box and the checkout both use inclGST(unitPriceForQty(...))", () => {
    // Unchanged by this work, asserted again because the refactor moved the
    // body of unitPriceForQty.
    expect(read("frontend/components/commerce/product-buy-box.tsx")).toMatch(
      /inclGSTForProduct\(product, unitPriceForQty\(product, qty\)\)/,
    );
    expect(read("app/api/checkout/create-order/route.ts")).toMatch(
      /inclGSTForProduct\(product, unitPriceForQty\(product, qty\)\)/,
    );
  });
});
