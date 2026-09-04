import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { availabilityLabel, type Product } from "../apps/website/src/frontend/lib/catalog";
import { mapProduct } from "../apps/website/src/frontend/lib/cms";

/**
 * The product page stated two things it could not support.
 *
 * ONE — "In stock" on a discontinued product. Both the card
 * (`catalog-product-card.tsx:146`) and the buy box
 * (`product-buy-box.tsx:37`) chose the label from `inStock` alone:
 *
 *     {product.inStock ? "In stock" : "Made to order"}
 *
 * `productType` never entered it. A discontinued item with `inStock` still true
 * — the ordinary state, because retiring a product is a `productType` change,
 * not a stock movement — advertised itself as in stock while the same page
 * offered no way to buy it and showed "On request" instead. The rest of the
 * stack already agrees discontinued is not purchasable: `isQuoteOnly` includes
 * it (catalog.ts:305), `create-order/route.ts:130` refuses it server-side, and
 * the JSON-LD Offer is suppressed entirely (schema.ts:270). Only the visible
 * label disagreed, which made the page contradict itself rather than the
 * customer merely being under-informed.
 *
 * TWO — an invented delivery promise. `cms.ts:297` read
 *
 *     leadTime: d.leadTime ?? "Ships in 1–2 weeks"
 *
 * and `leadTime` is an optional CMS field with no default (Products.ts:346).
 * So every product where staff left it blank told customers it ships in one to
 * two weeks — a commitment nobody in the business had made. It reached the buy
 * box, the delivery row in the product tabs, and the JSON-LD FAQ answer
 * (schema.ts:439). CLAUDE.md:143 already forbids exactly this: "No fabricated
 * content. Structured data and copy must trace to a real CMS field or a real
 * page." This is that rule applied, not a new one.
 */

const P = (over: Partial<Product> = {}): Product =>
  ({
    slug: "cell",
    name: "Cell",
    price: 1800,
    moq: 1,
    priceTiers: [],
    inStock: true,
    productType: "in-stock",
    ...over,
  }) as unknown as Product;

describe("what the availability line says", () => {
  it("a discontinued product does not claim to be in stock", () => {
    // THE REGRESSION. `inStock` stays true when a product is retired, because
    // retiring is a productType change, not a stock movement.
    expect(availabilityLabel(P({ productType: "discontinued", inStock: true } as Partial<Product>))).toBe(
      "Discontinued",
    );
  });

  it("stays Discontinued even with no stock", () => {
    expect(
      availabilityLabel(P({ productType: "discontinued", inStock: false } as Partial<Product>)),
    ).toBe("Discontinued");
  });

  it("a made-to-order product says so regardless of the stock flag", () => {
    expect(availabilityLabel(P({ productType: "made-to-order", inStock: true } as Partial<Product>))).toBe(
      "Made to order",
    );
  });

  it("an ordinary in-stock product is unchanged", () => {
    expect(availabilityLabel(P())).toBe("In stock");
  });

  it("an ordinary product without stock is unchanged", () => {
    expect(availabilityLabel(P({ inStock: false } as Partial<Product>))).toBe("Made to order");
  });

  it("quote-only is left alone — it is not a contradiction", () => {
    // "Request a quote" and "In stock" can both be true: the item exists, it
    // just is not sold through instant checkout. Only discontinued was lying.
    expect(availabilityLabel(P({ productType: "quote-only", inStock: true } as Partial<Product>))).toBe(
      "In stock",
    );
  });

  it("a product with no productType at all behaves as before", () => {
    expect(availabilityLabel(P({ productType: undefined } as Partial<Product>))).toBe("In stock");
  });
});

describe("lead time is never invented", () => {
  const cms = (over: Record<string, unknown> = {}) =>
    mapProduct({
      id: "1",
      slug: "cell",
      name: "Cell",
      price: 1800,
      ...over,
    } as never);

  it("a blank lead time stays blank", () => {
    // The fabrication in one assertion: this used to come back as
    // "Ships in 1–2 weeks" for a field nobody had filled in.
    expect(cms().leadTime).toBeUndefined();
  });

  it("an empty string is treated as blank, not as a promise", () => {
    expect(cms({ leadTime: "" }).leadTime).toBeUndefined();
    expect(cms({ leadTime: "   " }).leadTime).toBeUndefined();
  });

  it("a real lead time is passed through exactly", () => {
    expect(cms({ leadTime: "Ships in 3–4 weeks" }).leadTime).toBe("Ships in 3–4 weeks");
  });

  it("nothing else about the mapping changed", () => {
    const p = cms({ leadTime: "Ships tomorrow", moq: 5, unit: "kg" });
    expect(p.moq).toBe(5);
    expect(p.unit).toBe("kg");
    expect(p.inStock).toBe(true);
  });
});

describe("the render sites use the shared rule and handle a missing lead time", () => {
  const read = (p: string) =>
    readFileSync(join(__dirname, "..", "apps", "website", "src", p), "utf8");

  it("the buy box asks availabilityLabel rather than deciding for itself", () => {
    const src = read("frontend/components/commerce/product-buy-box.tsx");
    expect(src).toMatch(/availabilityLabel\(product\)/);
    expect(src, "the old inStock-only expression is gone").not.toMatch(
      /product\.inStock \? "In stock" : "Made to order"/,
    );
  });

  it("the product card asks the same helper", () => {
    const src = read("frontend/components/commerce/catalog-product-card.tsx");
    expect(src).toMatch(/availabilityLabel\(product\)/);
    expect(src).not.toMatch(/product\.inStock \? "In stock" : "Made to order"/);
  });

  it("the buy box does not print a dangling separator when there is no lead time", () => {
    // `... · {product.leadTime}` rendered "In stock · " with nothing after it.
    // Asserted as the GUARD being present rather than as the absence of one
    // particular old spelling — an unguarded template literal is the same
    // defect written differently, and the negative form did not catch it.
    const src = read("frontend/components/commerce/product-buy-box.tsx");
    expect(src).toMatch(/product\.leadTime \?[\s\S]{0,80}?leadTime[\s\S]{0,40}?: null/);
  });

  it("the delivery row is omitted rather than blank", () => {
    const src = read("frontend/components/commerce/product-tabs.tsx");
    expect(src).toMatch(/product\.leadTime \?/);
  });

  it("the structured-data FAQ already guarded it, and still does", () => {
    // schema.ts was the one place that got this right. Pinned so the fix does
    // not regress it while changing the type to optional.
    const src = read("frontend/components/seo/schema.ts");
    expect(src).toMatch(/p\.leadTime \? ` \$\{p\.leadTime\}\.` : ""/);
  });

  it("no render site hardcodes a shipping window", () => {
    // Comments are stripped first, the same way stock-guards.test.ts does it:
    // the fix's own comment QUOTES the string it removed, and a source scan
    // must not be tripped — or satisfied — by prose.
    const withoutComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    for (const f of [
      "frontend/components/commerce/product-buy-box.tsx",
      "frontend/components/commerce/product-tabs.tsx",
      "frontend/lib/cms.ts",
    ]) {
      expect(withoutComments(read(f)), f).not.toMatch(/Ships in 1–2 weeks/);
    }
  });
});

describe("what the rest of the stack already agreed about discontinued", () => {
  const read = (p: string) =>
    readFileSync(join(__dirname, "..", "apps", "website", "src", p), "utf8");

  it("it is quote-only, so there is no Add to cart", () => {
    expect(read("frontend/lib/catalog.ts")).toMatch(
      /productType === "quote-only" \|\| product\.productType === "discontinued"/,
    );
  });

  it("the checkout refuses it server-side, not just in the UI", () => {
    const src = read("app/api/checkout/create-order/route.ts");
    expect(src).toMatch(/discontinued/);
  });

  it("the JSON-LD Offer is suppressed for it", () => {
    expect(read("frontend/components/seo/schema.ts")).toMatch(/quote-only \/ discontinued/);
  });
});
