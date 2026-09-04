import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
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
      /inclGST\(unitPriceForQty\(product, qty\)\)/,
    );
    expect(read("app/api/checkout/create-order/route.ts")).toMatch(
      /inclGST\(unitPriceForQty\(product, qty\)\)/,
    );
  });
});
