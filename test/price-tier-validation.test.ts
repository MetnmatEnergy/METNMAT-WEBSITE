import { describe, it, expect } from "vitest";
import { validatePriceTiers } from "../apps/dashboard/src/lib/price-tiers";
import { Products } from "../apps/dashboard/src/collections/Products";
import type { Field } from "payload";

/**
 * Refusing to SAVE a tier that could never be charged correctly.
 *
 * unitPriceForQty now ignores a malformed tier, which protects money already in
 * flight. This is the other half: the employee finds out at the moment they
 * type it, inline, instead of discovering later that a row they entered does
 * nothing — or worse, that it discounted an order.
 *
 * The messages matter as much as the rule. "Validation failed" tells a staff
 * member nothing; naming the tier and the number they typed tells them exactly
 * what to change.
 */

const ctx = (price?: number) => ({ siblingData: { price } });

describe("tiers are optional", () => {
  it.each([[[]], [undefined], [null]])("accepts %s", (v) => {
    expect(validatePriceTiers(v, ctx(1800))).toBe(true);
  });

  it("accepts a normal descending price list", () => {
    expect(
      validatePriceTiers(
        [
          { minQty: 10, price: 1700 },
          { minQty: 50, price: 1600 },
          { minQty: 100, price: 1450 },
        ],
        ctx(1800),
      ),
    ).toBe(true);
  });

  it("accepts the same list written deepest-first", () => {
    // Order is a presentation matter — unitPriceForQty picks the deepest
    // qualifying break regardless of array position, so refusing a save over row
    // order would be inventing a rule.
    expect(
      validatePriceTiers(
        [
          { minQty: 100, price: 1450 },
          { minQty: 10, price: 1700 },
        ],
        ctx(1800),
      ),
    ).toBe(true);
  });
});

describe("a tier that could never be charged is refused", () => {
  it("refuses a NEGATIVE price — the one that could discount a real order", () => {
    const msg = validatePriceTiers([{ minQty: 25, price: -1000 }], ctx(1800));
    expect(msg).toBeTypeOf("string");
    expect(msg).toMatch(/more than 0/);
  });

  it("refuses a ZERO price, which `required: true` does not catch", () => {
    // payload's number validator tests `!value && !isNumber(value)`, and
    // isNumber(0) is true — so required never fires for 0.
    expect(validatePriceTiers([{ minQty: 25, price: 0 }], ctx(1800))).toBeTypeOf("string");
  });

  it("refuses a price ABOVE the base — buying more must not cost more", () => {
    const msg = validatePriceTiers([{ minQty: 25, price: 2000 }], ctx(1800)) as string;
    expect(msg).toMatch(/more than the normal price/);
    expect(msg).toMatch(/2,000/);
    expect(msg).toMatch(/1,800/);
  });

  it("allows a tier equal to the base price", () => {
    // Pointless but not wrong, and refusing it would be inventing a rule.
    expect(validatePriceTiers([{ minQty: 25, price: 1800 }], ctx(1800))).toBe(true);
  });

  it("refuses a quantity below 1", () => {
    // A break at qty 0 would apply to every order, silently repricing the item.
    expect(validatePriceTiers([{ minQty: 0, price: 1500 }], ctx(1800))).toBeTypeOf("string");
    expect(validatePriceTiers([{ minQty: -5, price: 1500 }], ctx(1800))).toBeTypeOf("string");
  });

  it("refuses a fractional quantity", () => {
    expect(validatePriceTiers([{ minQty: 2.5, price: 1500 }], ctx(1800))).toBeTypeOf("string");
  });

  it("refuses two tiers starting at the same quantity", () => {
    const msg = validatePriceTiers(
      [
        { minQty: 25, price: 1600 },
        { minQty: 25, price: 1500 },
      ],
      ctx(1800),
    ) as string;
    expect(msg).toMatch(/both start at 25/);
  });

  it("refuses a missing or non-numeric value", () => {
    expect(validatePriceTiers([{ minQty: 25 }], ctx(1800))).toBeTypeOf("string");
    expect(validatePriceTiers([{ price: 1500 }], ctx(1800))).toBeTypeOf("string");
    expect(validatePriceTiers([{ minQty: 25, price: Number.NaN }], ctx(1800))).toBeTypeOf("string");
  });
});

describe("the message names the row and the number", () => {
  it("says which tier is wrong", () => {
    const msg = validatePriceTiers(
      [
        { minQty: 10, price: 1700 },
        { minQty: 50, price: -5 },
      ],
      ctx(1800),
    ) as string;
    expect(msg).toMatch(/^Tier 2:/);
  });

  it("works when there is no base price to compare against", () => {
    // A quote-only product has no price. The other rules still apply; the
    // "cheaper than base" one cannot, and must not throw.
    expect(validatePriceTiers([{ minQty: 25, price: 1500 }], ctx(undefined))).toBe(true);
    expect(validatePriceTiers([{ minQty: 25, price: -1 }], ctx(undefined))).toBeTypeOf("string");
  });

  it("tolerates being called with no context at all", () => {
    expect(validatePriceTiers([{ minQty: 25, price: 1500 }])).toBe(true);
  });
});

describe("it is wired to the collection", () => {
  const find = (fields: Field[], name: string): Field | undefined => {
    for (const f of fields) {
      if ("name" in f && f.name === name) return f;
      const nested =
        ("fields" in f && (f.fields as Field[])) ||
        ("tabs" in f && (f.tabs as { fields: Field[] }[]).flatMap((t) => t.fields)) ||
        null;
      if (nested) {
        const hit = find(nested as Field[], name);
        if (hit) return hit;
      }
    }
    return undefined;
  };

  it("Products.priceTiers validates through this function", () => {
    // A validator that exists and is not wired protects nothing, while every
    // unit test of it still passes.
    const tiers = find(Products.fields, "priceTiers") as { validate?: unknown };
    expect(tiers).toBeDefined();
    expect(tiers.validate).toBe(validatePriceTiers);
  });

  it("the row fields carry their own floors as a second line of defence", () => {
    const tiers = find(Products.fields, "priceTiers") as { fields?: Field[] };
    const minQty = find(tiers.fields ?? [], "minQty") as { min?: number };
    const price = find(tiers.fields ?? [], "price") as { min?: number };
    expect(minQty.min).toBe(1);
    expect(price.min).toBe(0);
  });
});

describe("a tier below the MOQ would make the base price unreachable", () => {
  /*
   * INFERRED FROM MOQ SEMANTICS, not from a stated business rule — flagged as
   * such in the audit report.
   *
   * MOQ is the smallest quantity anyone can order. A bulk break at or below it
   * therefore applies to EVERY possible order, so the base price the commercial
   * team set can never be charged. The product page then prints the base row as
   * "10–1 pc" — an inverted range that reads as a rendering glitch rather than
   * an error — and quietly bills the tier rate forever.
   *
   * Refusing is the conservative choice because the state is incoherent rather
   * than merely unusual: there is no quantity at which the base price applies.
   * The message names both numbers so staff can fix whichever is wrong.
   */
  it("refuses a tier starting at or below the MOQ", () => {
    const msg = validatePriceTiers([{ minQty: 2, price: 1650 }], {
      siblingData: { price: 1800, moq: 10 },
    }) as string;
    expect(msg).toMatch(/minimum order/i);
    expect(msg).toContain("10");
  });

  it("refuses a tier exactly AT the MOQ, which also applies to every order", () => {
    expect(
      validatePriceTiers([{ minQty: 10, price: 1650 }], { siblingData: { price: 1800, moq: 10 } }),
    ).toBeTypeOf("string");
  });

  it("accepts a tier above the MOQ", () => {
    expect(
      validatePriceTiers([{ minQty: 25, price: 1650 }], { siblingData: { price: 1800, moq: 10 } }),
    ).toBe(true);
  });

  it("does not apply the rule when no MOQ is set", () => {
    // Most products have no MOQ; the rule must not fire on them.
    expect(
      validatePriceTiers([{ minQty: 2, price: 1650 }], { siblingData: { price: 1800 } }),
    ).toBe(true);
  });

  it("treats MOQ 1 as no constraint beyond the existing minQty >= 1", () => {
    expect(
      validatePriceTiers([{ minQty: 2, price: 1650 }], { siblingData: { price: 1800, moq: 1 } }),
    ).toBe(true);
  });
});
