import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isQuoteOnly, formatINR, type Product } from "../apps/website/src/frontend/lib/catalog";

/**
 * The storefront showed a price the CMS says it must not show.
 *
 * `Products.productType` states the rule to staff in its own field description
 * (Products.ts:547), and it is unambiguous:
 *
 *   "Quote only / Discontinued = enquiry-only: no Buy button, NO PRICE SHOWN,
 *    no purchase Offer in SEO data."
 *
 * Two thirds of that held. The Add-to-cart button is correctly suppressed on
 * both the card and the buy box, and the JSON-LD Offer is suppressed
 * (schema.ts:270). The price was not: `PriceBlock` rendered
 * `money(inclGST(product.price))` on any product with a price above zero,
 * `productType` never entering it — together with the MRP strike-through and
 * the "% off" badge. The bulk-pricing table rendered too, printing real
 * per-unit tier prices beside an item nothing can buy.
 *
 * A quote-only product priced at 0 already read "On request", which is why this
 * stayed hidden: it only shows on a quote-only or discontinued product that
 * still carries a price — the ordinary state when something is retired, since
 * retiring is a productType change and does not clear the price.
 *
 * This is the CMS's own stated rule being applied, not a new one, which is why
 * it needed no business decision. `isQuoteOnly` already existed as the shared
 * predicate — the storefront simply was not asking it here.
 */

const P = (over: Partial<Product> = {}): Product =>
  ({
    slug: "cell",
    name: "Cell",
    price: 1800,
    mrp: 2400,
    moq: 1,
    unit: "pc",
    priceTiers: [],
    inStock: true,
    productType: "in-stock",
    ...over,
  }) as unknown as Product;

describe("who counts as enquiry-only", () => {
  it("quote-only and discontinued do, even when priced", () => {
    expect(isQuoteOnly(P({ productType: "quote-only" } as Partial<Product>))).toBe(true);
    expect(isQuoteOnly(P({ productType: "discontinued" } as Partial<Product>))).toBe(true);
  });

  it("an unpriced product does whatever its type says", () => {
    expect(isQuoteOnly(P({ price: 0 } as Partial<Product>))).toBe(true);
  });

  it("ordinary buyable products do not", () => {
    expect(isQuoteOnly(P())).toBe(false);
    expect(isQuoteOnly(P({ productType: "made-to-order" } as Partial<Product>))).toBe(false);
  });

  it("'On request' is what a suppressed price already reads as", () => {
    // The wording is not invented here — formatINR has always said this for 0.
    expect(formatINR(0)).toBe("On request");
  });
});

describe("the price block honours the rule", () => {
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

  it("derives the flag from isQuoteOnly, not from the price alone", () => {
    // Asserted as the ASSIGNMENT, not as "isQuoteOnly appears somewhere" — the
    // tier table calls it too, so the looser form was satisfied by a version
    // that had quietly gone back to `!product.price` here.
    expect(src).toMatch(/const quoteOnly = isQuoteOnly\(product\);/);
  });

  it("the price itself is the thing suppressed", () => {
    // The MRP, badge and unit-line assertions below all passed while the price
    // was still printed, because each only pinned its own row.
    expect(src).toMatch(
      /\{quoteOnly[\s\S]{0,120}?money\(inclGST\(product\.price\)/,
    );
  });

  it("suppresses the MRP strike-through as well as the price", () => {
    // A struck-through "was ₹2,400" beside "On request" is the same claim in a
    // different shape.
    expect(src).toMatch(/!quoteOnly && product\.mrp|quoteOnly \? null[\s\S]{0,200}?mrp/);
  });

  it("suppresses the discount badge", () => {
    expect(src).toMatch(/!quoteOnly && discount > 0|discount > 0 && !quoteOnly/);
  });

  it("suppresses the per-unit incl. GST line", () => {
    expect(src).toMatch(/!quoteOnly && product\.price > 0|product\.price > 0 && !quoteOnly/);
  });

  it("the bulk table does not render for an enquiry-only product", () => {
    // "No price shown" covers the tier table too — it is nothing but prices.
    expect(src).toMatch(/if \(isQuoteOnly\(product\)\) return null/);
  });
});

describe("what was already correct stays correct", () => {
  const read = (p: string) =>
    readFileSync(join(__dirname, "..", "apps", "website", "src", p), "utf8");

  it("Add to cart is still suppressed on the buy box", () => {
    expect(read("frontend/components/commerce/product-buy-box.tsx")).toMatch(/isQuoteOnly/);
  });

  it("Add to cart is still suppressed on the card", () => {
    expect(read("frontend/components/commerce/catalog-product-card.tsx")).toMatch(/isQuoteOnly/);
  });

  it("the JSON-LD purchase Offer is still suppressed", () => {
    expect(read("frontend/components/seo/schema.ts")).toMatch(/quote-only \/ discontinued/);
  });

  it("the checkout still refuses it server-side", () => {
    expect(read("app/api/checkout/create-order/route.ts")).toMatch(/discontinued/);
  });
});

describe("the rule being enforced is the CMS's own", () => {
  it("the productType description still says no price is shown", () => {
    // If this wording ever changes, the storefront behaviour should be
    // revisited deliberately rather than drifting apart from it again.
    const src = readFileSync(
      join(__dirname, "..", "apps", "dashboard", "src", "collections", "Products.ts"),
      "utf8",
    );
    expect(src).toMatch(/no Buy button, no price shown/);
  });
});
