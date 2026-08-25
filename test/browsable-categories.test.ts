import { describe, it, expect } from "vitest";
import { selectBrowsable } from "../apps/website/src/frontend/lib/catalog";

/**
 * Which departments the shop advertises.
 *
 * Ten of the twenty-six production categories had no products, and every one
 * rendered a card leading to an empty page and a thin URL in the sitemap. This
 * decides what a customer is offered, so it is tested against fixed data rather
 * than confirmed by looking at production.
 */
const cat = (slug: string, parent?: string) => ({ slug, parent });
const prod = (categorySlug: string) => ({ categorySlug });

describe("selectBrowsable", () => {
  it("keeps categories that have products", () => {
    const out = selectBrowsable([cat("pumps")], [prod("pumps")]);
    expect(out.map((c) => c.slug)).toEqual(["pumps"]);
  });

  it("drops categories with none", () => {
    const out = selectBrowsable([cat("pumps"), cat("analysis")], [prod("pumps")]);
    expect(out.map((c) => c.slug)).toEqual(["pumps"]);
  });

  it("keeps a parent whose CHILD has the products", () => {
    // The parent's listing page draws from its children, so it is not empty.
    const cats = [cat("membranes"), cat("pem", "membranes")];
    const out = selectBrowsable(cats, [prod("pem")]);
    expect(out.map((c) => c.slug).sort()).toEqual(["membranes", "pem"]);
  });

  it("drops a parent whose children are all empty", () => {
    const cats = [cat("membranes"), cat("pem", "membranes")];
    expect(selectBrowsable(cats, [])).toEqual([]);
  });

  it("follows more than one level down", () => {
    const cats = [cat("a"), cat("b", "a"), cat("c", "b")];
    expect(selectBrowsable(cats, [prod("c")]).map((c) => c.slug).sort()).toEqual(["a", "b", "c"]);
  });

  it("terminates on a parent/child cycle instead of hanging", () => {
    // Bad data, not a reason to hang the shop page.
    const cats = [
      { slug: "x", parent: "y" },
      { slug: "y", parent: "x" },
    ];
    expect(selectBrowsable(cats, [])).toEqual([]);
    expect(selectBrowsable(cats, [prod("x")]).map((c) => c.slug).sort()).toEqual(["x", "y"]);
  });

  it("preserves input order so the caller's sort still applies", () => {
    const cats = [cat("z"), cat("a"), cat("m")];
    const out = selectBrowsable(cats, [prod("z"), prod("a"), prod("m")]);
    expect(out.map((c) => c.slug)).toEqual(["z", "a", "m"]);
  });

  it("handles an empty catalogue without throwing", () => {
    expect(selectBrowsable([], [])).toEqual([]);
    expect(selectBrowsable([cat("a")], [])).toEqual([]);
  });

  it("ignores products pointing at a category that does not exist", () => {
    // An orphaned product must not resurrect a department.
    const out = selectBrowsable([cat("real")], [prod("deleted-slug")]);
    expect(out).toEqual([]);
  });

  /**
   * The case that prompted the change, in the shape production is actually in.
   * The important property is not which cards vanish — it is that no PRODUCT
   * becomes unreachable when they do.
   */
  it("hides the empty departments while keeping every product reachable", () => {
    const cats = [
      cat("peristaltic-pumps"),
      cat("reference-electrodes"),
      cat("analysis"), // Analysis Instruments — 0 products in production
      cat("equipments"), // Equipment & Accessories — 0 products in production
      cat("consumables"),
    ];
    const prods = [
      prod("peristaltic-pumps"),
      prod("peristaltic-pumps"),
      prod("peristaltic-pumps"),
      prod("peristaltic-pumps"),
      prod("reference-electrodes"),
    ];

    const shown = selectBrowsable(cats, prods).map((c) => c.slug);
    expect(shown).toContain("peristaltic-pumps");
    expect(shown).not.toContain("analysis");
    expect(shown).not.toContain("equipments");
    expect(shown).not.toContain("consumables");

    const reachable = prods.filter((p) => shown.includes(p.categorySlug)).length;
    expect(reachable).toBe(prods.length);
  });
});
