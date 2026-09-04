import { describe, it, expect } from "vitest";
import { categoryDeleteBlocker } from "../apps/dashboard/src/hooks/category-guards";

/**
 * A category may not be deleted out from under the things that point at it.
 *
 * `Products.category` is a REQUIRED relationship, so deleting a category left
 * products pointing at an id that no longer resolves: the storefront rendered a
 * product with a null category, the shop grid lost it from every listing, and
 * the next save failed validation on a required field the editor had no obvious
 * way to fix. Child categories orphaned the same way.
 */

describe("categoryDeleteBlocker", () => {
  it("permits deleting an empty category", () => {
    expect(categoryDeleteBlocker({ products: 0, children: 0 })).toBeNull();
  });

  it("blocks while products still point at it", () => {
    const msg = categoryDeleteBlocker({ products: 12, children: 0, name: "Electrodes" });
    expect(msg).toContain("Electrodes");
    expect(msg).toContain("12 products");
    expect(msg).toMatch(/Move those products/);
  });

  it("blocks while sub-categories still point at it", () => {
    const msg = categoryDeleteBlocker({ products: 0, children: 3, name: "Reactors" });
    expect(msg).toContain("3 sub-categories");
    expect(msg).toMatch(/Re-parent/);
  });

  it("names both obstacles when both are present", () => {
    const msg = categoryDeleteBlocker({ products: 2, children: 1, name: "Cells" })!;
    expect(msg).toContain("2 products");
    expect(msg).toContain("1 sub-category");
    expect(msg).toMatch(/Move the products .* and re-parent/i);
  });

  it("gets the singular right — an error that says '1 products' reads as a bug", () => {
    expect(categoryDeleteBlocker({ products: 1, children: 0 })).toContain("1 product.");
    expect(categoryDeleteBlocker({ products: 0, children: 1 })).toContain("1 sub-category");
  });

  it("still says something useful without a category name", () => {
    const msg = categoryDeleteBlocker({ products: 4, children: 0, name: null })!;
    expect(msg).toMatch(/^This category/);
  });

  it("treats negative or nonsense counts as nothing blocking", () => {
    expect(categoryDeleteBlocker({ products: -1, children: 0 })).toBeNull();
  });

  it("offers hiding as the alternative, since the collection supports it", () => {
    // Categories carry a `hidden` flag precisely so a department can be retired
    // without destroying what is filed under it.
    expect(categoryDeleteBlocker({ products: 5, children: 0 })).toMatch(/hide this one/);
  });
});
