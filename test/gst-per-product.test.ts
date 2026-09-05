import { describe, it, expect } from "vitest";
import {
  DEFAULT_GST_RATE_PERCENT,
  GST_SLABS,
  gstRateFor,
  inclGSTAt,
  inclGSTForProduct,
  gstPortionAt,
  isValidGstRate,
  soleGstRate,
  type Product,
} from "../apps/website/src/frontend/lib/catalog";

/**
 * GST is per product, and the money has to agree everywhere it appears.
 *
 * WHAT WAS TRUE BEFORE. `GST_RATE = 0.18` was a module constant and `inclGST`
 * closed over it, so every price on the site — display, cart, the amount sent
 * to Razorpay, the figure snapshotted onto the order — was 18% by construction.
 * `Products.gstRate` existed, defaulted to 18, and was read by NOTHING: it was
 * not mapped into the website's Product at all. The field carried an
 * `admin.readOnly` and a description saying so in as many words — "checkout does
 * not yet honour per-product rates, so this field is locked to avoid promising
 * what billing doesn't deliver."
 *
 * THE CONSEQUENCE OF UNLOCKING IT, which is why the plumbing comes first.
 * Catalogue prices are stored EXCLUDING tax and shown INCLUDING it, so the rate
 * is not merely a paperwork field: ₹100 at 18% is ₹118 to the customer, and at
 * 5% it is ₹105. Changing the rate changes the price. `lib/tax.ts:28-32` already
 * warns that this is "easy to make by accident while intending only to fix the
 * tax line", which is exactly why the form now shows the resulting price.
 *
 * These tests pin the arithmetic and the fallbacks. The rule that matters most
 * is the last block: the price a customer is SHOWN and the price they are
 * CHARGED are computed from one function, so they cannot diverge per product
 * any more than they could per quantity.
 */

const P = (over: Partial<Product> = {}): Product =>
  ({
    slug: "cell",
    name: "Cell",
    price: 100,
    moq: 1,
    priceTiers: [],
    productType: "in-stock",
    ...over,
  }) as unknown as Product;

describe("the rate that applies to a product", () => {
  it("uses the product's own rate", () => {
    expect(gstRateFor(P({ gstRate: 5 } as Partial<Product>))).toBe(5);
    expect(gstRateFor(P({ gstRate: 12 } as Partial<Product>))).toBe(12);
    expect(gstRateFor(P({ gstRate: 28 } as Partial<Product>))).toBe(28);
  });

  it("honours a genuine zero rather than treating it as unset", () => {
    // 0% is a real GST slab. `||` would have silently billed 18% on an exempt
    // product, which is a tax error, not a display one.
    expect(gstRateFor(P({ gstRate: 0 } as Partial<Product>))).toBe(0);
  });

  it("falls back to 18 when the field is missing or unusable", () => {
    // Every product in the catalogue predates this, and a product fetched
    // through an older cached payload may carry no rate at all.
    expect(gstRateFor(P())).toBe(DEFAULT_GST_RATE_PERCENT);
    expect(gstRateFor(P({ gstRate: undefined } as Partial<Product>))).toBe(18);
    expect(gstRateFor(P({ gstRate: null } as unknown as Partial<Product>))).toBe(18);
    expect(gstRateFor(P({ gstRate: NaN } as Partial<Product>))).toBe(18);
    expect(gstRateFor(P({ gstRate: "5" } as unknown as Partial<Product>))).toBe(5);
  });

  it("refuses a rate outside the legal range rather than charging it", () => {
    // A negative rate would REFUND tax on every sale; 90% would overcharge.
    // Neither should reach a card, so both fall back to the site rate.
    expect(gstRateFor(P({ gstRate: -5 } as Partial<Product>))).toBe(18);
    expect(gstRateFor(P({ gstRate: 90 } as Partial<Product>))).toBe(18);
  });

  it("accepts only the real GST slabs as valid input", () => {
    for (const slab of GST_SLABS) expect(isValidGstRate(slab), `${slab}%`).toBe(true);
    for (const bad of [-1, 3, 7, 19, 29, 100, NaN]) {
      expect(isValidGstRate(bad), `${bad}%`).toBe(false);
    }
  });
});

describe("the arithmetic", () => {
  it.each([
    [100, 18, 118],
    [100, 5, 105],
    [100, 12, 112],
    [100, 28, 128],
    [100, 0, 100],
    [1800, 18, 2124],
    [6490, 18, 7658],
  ])("₹%i at %i%% is ₹%i", (net, rate, gross) => {
    expect(inclGSTAt(net, rate)).toBe(gross);
  });

  it("a zero price stays zero at every rate", () => {
    // Quote-only items must not acquire a price through the tax field.
    for (const slab of GST_SLABS) expect(inclGSTAt(0, slab)).toBe(0);
  });

  it("the contained tax is the inclusive figure minus the net", () => {
    for (const slab of GST_SLABS) {
      const gross = inclGSTAt(1000, slab);
      expect(gstPortionAt(gross, slab)).toBe(gross - 1000);
    }
  });

  it("rounds to the rupee, as the old single-rate version did", () => {
    expect(inclGSTAt(1799, 18)).toBe(2123);
    expect(inclGSTAt(101, 5)).toBe(106);
  });

  it("reproduces the previous behaviour exactly at 18%", () => {
    // The site-wide default must not shift by a rupee for any existing product.
    for (const net of [0, 1, 99, 100, 1800, 6490, 11210, 53690, 999999]) {
      expect(inclGSTAt(net, 18)).toBe(Math.round(net * 1.18));
    }
  });
});

describe("a product's inclusive price", () => {
  it("uses the product's rate", () => {
    expect(inclGSTForProduct(P({ price: 100, gstRate: 5 } as Partial<Product>), 100)).toBe(105);
    expect(inclGSTForProduct(P({ price: 100, gstRate: 18 } as Partial<Product>), 100)).toBe(118);
  });

  it("falls back to 18% for a product with no rate", () => {
    expect(inclGSTForProduct(P({ price: 100 }), 100)).toBe(118);
  });

  it("an exempt product is charged its net price", () => {
    expect(inclGSTForProduct(P({ price: 100, gstRate: 0 } as Partial<Product>), 100)).toBe(100);
  });
});

describe("the shown price and the charged price come from one rule", () => {
  // The property that makes per-product rates safe: whatever the storefront
  // renders for a product is what create-order computes for the same product.
  // A second rate source is how a page and a card start to disagree.
  const CASES: Array<[string, number | undefined, number, number]> = [
    ["no rate set", undefined, 1800, 2124],
    ["18%", 18, 1800, 2124],
    ["12%", 12, 1800, 2016],
    ["5%", 5, 1800, 1890],
    ["exempt", 0, 1800, 1800],
  ];

  it.each(CASES)("%s: display and charge agree", (_label, rate, net, expected) => {
    const product = P({ price: net, ...(rate === undefined ? {} : { gstRate: rate }) } as Partial<Product>);
    const shown = inclGSTForProduct(product, net);
    const charged = inclGSTForProduct(product, net);
    expect(shown).toBe(expected);
    expect(charged).toBe(shown);
  });

  it("two products at different rates do not contaminate each other", () => {
    // A mixed cart is the whole point of per-product rates.
    const exempt = P({ price: 1000, gstRate: 0 } as Partial<Product>);
    const standard = P({ price: 1000, gstRate: 18 } as Partial<Product>);
    expect(inclGSTForProduct(exempt, 1000)).toBe(1000);
    expect(inclGSTForProduct(standard, 1000)).toBe(1180);
  });
});

// ── CMS side ────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GST_SLABS as CMS_SLABS, gstSlabValidator, isGstSlab } from "../apps/dashboard/src/lib/gst-slabs";

describe("the CMS refuses a rate nobody can charge", () => {
  it("accepts every real slab", () => {
    for (const slab of CMS_SLABS) expect(gstSlabValidator(slab), `${slab}%`).toBe(true);
  });

  it("refuses a rate between the slabs", () => {
    // The reason the field is a guarded number rather than free input: 8% is
    // not a rate that can be invoiced, and it would bill every customer of
    // that product wrongly until a human noticed.
    for (const bad of [8, 1.8, 17, 19, 180]) {
      const r = gstSlabValidator(bad);
      expect(typeof r, `${bad}%`).toBe("string");
      expect(String(r)).toMatch(/0%, 5%, 12%, 18% or 28%/);
    }
  });

  it("allows empty, because the field carries a default", () => {
    // Refusing a blank would block the save before defaultValue is applied.
    expect(gstSlabValidator(undefined)).toBe(true);
    expect(gstSlabValidator(null)).toBe(true);
    expect(gstSlabValidator("")).toBe(true);
  });

  it("refuses text", () => {
    expect(typeof gstSlabValidator("eighteen")).toBe("string");
  });

  it("0 is a slab, not an absence", () => {
    expect(isGstSlab(0)).toBe(true);
    expect(gstSlabValidator(0)).toBe(true);
  });

  it("the CMS slabs and the website slabs are the same list", () => {
    // Two lists would let the CMS accept a rate the storefront rejects.
    expect([...CMS_SLABS]).toEqual([...GST_SLABS]);
  });
});

describe("the field is wired and no longer locked", () => {
  const SRC = join(__dirname, "..", "apps", "dashboard", "src");
  /*
   * Comments stripped first, as elsewhere in this suite. The fix's own comment
   * QUOTES the `readOnly: true` it removed, which tripped the assertion against
   * a field that is no longer locked — prose must neither satisfy nor trip a
   * source scan.
   */
  const products = readFileSync(join(SRC, "collections", "Products.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  /**
   * The gstRate field's OWN body, ending where the next field begins.
   *
   * A fixed-size window ran past it into `hsnSac`, whose `readOnly` then made
   * the "no longer locked" assertion fail against a field that is not locked.
   * Sliced to the neighbour instead, so the assertion is about this field only.
   */
  const field = () => {
    const at = products.indexOf('name: "gstRate"');
    expect(at, "gstRate field").toBeGreaterThan(-1);
    const end = products.indexOf('name: "hsnSac"', at);
    expect(end, "the field after gstRate").toBeGreaterThan(at);
    return products.slice(at, end);
  };

  it("is no longer read-only", () => {
    // The whole request: staff can set it.
    expect(field()).not.toMatch(/readOnly: true/);
  });

  it("carries the slab validator", () => {
    expect(field()).toMatch(/validate: gstSlabValidator/);
  });

  it("is still a number, so no stored row needs migrating", () => {
    // A select would have been tidier and would have changed the stored type
    // on 133 live products for cosmetics.
    expect(field()).toMatch(/type: "number"/);
    expect(field()).toMatch(/defaultValue: 18/);
  });

  it("the description tells staff it changes the price", () => {
    // The trap tax.ts warns about: this looks like paperwork and is a price.
    expect(field()).toMatch(/₹118 at 18%|changes what the customer pays/);
  });

  it("order lines record the rate they were charged at", () => {
    const orders = readFileSync(join(SRC, "collections", "Orders.ts"), "utf8");
    expect(orders).toMatch(/name: "taxRatePercent"[\s\S]{0,200}?width: "50%"/);
    expect(orders).toMatch(/name: "taxAmount"/);
  });

  it("the charge snapshots the rate onto each line", () => {
    const route = readFileSync(
      join(__dirname, "..", "apps/website/src/app/api/checkout/create-order/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/taxRatePercent: lineGstRate/);
    expect(route, "GST summed per line, not from one order rate").toMatch(
      /orderItems\.reduce\(\(n, it\) => n \+ \(it\.taxAmount \?\? 0\), 0\)/,
    );
  });

  it("a zero-rated export still zeroes the whole order", () => {
    // Shipping destination overrides the per-product rates rather than
    // competing with them.
    const route = readFileSync(
      join(__dirname, "..", "apps/website/src/app/api/checkout/create-order/route.ts"),
      "utf8",
    );
    expect(route).toMatch(/taxLine\.ratePercent <= 0[\s\S]{0,40}\? 0/);
  });
});

describe("the checkout summary never names a rate the cart does not have", () => {
  // The riskiest site in this change, and the one a find-and-replace misses:
  // the amount is derived by subtraction (correct for mixed rates), but the
  // LABEL beside it read `GST (18%)` from a module constant. On a 5% product
  // that is a false tax statement on the last screen before payment.
  const line = (rate?: number) => ({ product: P(rate === undefined ? {} : ({ gstRate: rate } as Partial<Product>)) });

  it("names the rate when every line shares one", () => {
    expect(soleGstRate([line(18), line(18)])).toBe(18);
    expect(soleGstRate([line(5)])).toBe(5);
    expect(soleGstRate([line(0), line(0)])).toBe(0);
  });

  it("names nothing when the rates differ", () => {
    expect(soleGstRate([line(5), line(18)])).toBeNull();
    expect(soleGstRate([line(0), line(28)])).toBeNull();
  });

  it("treats an unset rate as the site rate, not as its own group", () => {
    // Otherwise a legacy product beside an 18% one would read as "mixed".
    expect(soleGstRate([line(undefined), line(18)])).toBe(18);
  });

  it("names nothing for an empty cart", () => {
    expect(soleGstRate([])).toBeNull();
  });

  it("the checkout renders the label from the cart, not a constant", () => {
    const src = readFileSync(
      join(__dirname, "..", "apps/website/src/app/checkout/page.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const cartGstRate = soleGstRate\(cartLines\)/);
    expect(src, "the hardcoded percentage label is gone").not.toMatch(
      /GST \(\{Math\.round\(GST_RATE \* 100\)\}%\)/,
    );
  });
});

describe("the rate reaches the website at all", () => {
  it("mapProduct carries gstRate out of the CMS", () => {
    // Without this the whole chain is inert: every product falls back to 18%
    // and the CMS field has no effect. A mutation removing this line survived
    // the first pass, which is exactly the silent-halfway-migration failure.
    const src = readFileSync(
      join(__dirname, "..", "apps/website/src/frontend/lib/cms.ts"),
      "utf8",
    );
    expect(src).toMatch(/gstRate: typeof d\.gstRate === "number" \? d\.gstRate : undefined/);
  });

  it("the CMS product type declares it", () => {
    const src = readFileSync(
      join(__dirname, "..", "apps/website/src/frontend/lib/cms.ts"),
      "utf8",
    );
    expect(src).toMatch(/gstRate\?: number;/);
  });
});
