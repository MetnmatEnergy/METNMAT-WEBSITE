import { describe, it, expect } from "vitest";
import { planUpdate } from "../apps/dashboard/src/lib/stock";

/**
 * The filters that make a stock movement safe under concurrency.
 *
 * Two people adjusting the same product at once must not lose one another's
 * write. Rather than read-modify-write, each movement is issued as a single
 * atomic `findOneAndUpdate` whose FILTER carries the business rule — a stock-out
 * only matches a document that still has enough stock. If the filter does not
 * match, nothing is written and no ledger row is created.
 *
 * These tests pin that the guard is actually present on the movements that need
 * one, because a guard silently reduced to `{}` would still pass every
 * arithmetic test in stock-math while allowing exactly the oversell this exists
 * to prevent.
 */

const plan = (t: Parameters<typeof planUpdate>[0], q: number) => {
  const p = planUpdate(t, q);
  if (!p) throw new Error(`no plan for ${t}`);
  return p;
};

describe("increases need no guard", () => {
  it("stock-in and returned simply add", () => {
    for (const t of ["stock-in", "returned"] as const) {
      const p = plan(t, 5);
      expect(p.guard, `${t} needs no precondition`).toEqual({});
      expect(p.update).toEqual({ $inc: { stockQty: 5 } });
    }
  });
});

describe("decreases are guarded against going negative", () => {
  it("stock-out and damaged carry a precondition and decrement", () => {
    for (const t of ["stock-out", "damaged"] as const) {
      const p = plan(t, 4);
      expect(p.update).toEqual({ $inc: { stockQty: -4 } });
      expect(Object.keys(p.guard), `${t} must be guarded`).not.toEqual([]);
      expect(JSON.stringify(p.guard)).toContain("$expr");
    }
  });

  it("the guard subtracts the quantity and compares against reserved stock", () => {
    // The rule being encoded: what is left after this movement must still cover
    // everything already promised to orders.
    const g = JSON.stringify(plan("stock-out", 7).guard);
    expect(g).toContain("$subtract");
    expect(g).toContain("stockQty");
    expect(g).toContain("reservedStock");
    expect(g).toContain("$gte");
    expect(g).toContain("7");
  });

  it("treats a missing field as zero, for products created before inventory existed", () => {
    const g = JSON.stringify(plan("stock-out", 1).guard);
    expect(g).toContain("$ifNull");
  });
});

describe("reservations are guarded in both directions", () => {
  it("reserving cannot exceed what is on hand", () => {
    const p = plan("reserved", 3);
    expect(p.update).toEqual({ $inc: { reservedStock: 3 } });
    const g = JSON.stringify(p.guard);
    expect(g).toContain("$lte");
    expect(g).toContain("$add");
    expect(g).toContain("stockQty");
  });

  it("releasing cannot go below zero", () => {
    const p = plan("released", 2);
    expect(p.update).toEqual({ $inc: { reservedStock: -2 } });
    const g = JSON.stringify(p.guard);
    expect(g).toContain("$gte");
    expect(g).toContain("reservedStock");
  });
});

describe("the movement never touches the wrong counter", () => {
  it("on-hand movements leave reservedStock alone, and vice versa", () => {
    for (const t of ["stock-in", "stock-out", "damaged", "returned"] as const) {
      expect(JSON.stringify(plan(t, 1).update)).not.toContain("reservedStock");
    }
    for (const t of ["reserved", "released"] as const) {
      expect(JSON.stringify(plan(t, 1).update)).not.toContain("stockQty");
    }
  });

  it("every directional movement uses $inc, never an absolute $set", () => {
    // $inc is what makes concurrent movements additive rather than
    // last-write-wins, and it treats a missing field as zero.
    for (const t of ["stock-in", "stock-out", "reserved", "released", "damaged", "returned"] as const) {
      const u = plan(t, 1).update;
      expect(Object.keys(u), `${t}`).toEqual(["$inc"]);
    }
  });
});

describe("unknown movements produce no plan", () => {
  it("returns null rather than an unguarded write", () => {
    expect(planUpdate("adjustment" as never, 1)).toBeNull();
    expect(planUpdate("nonsense" as never, 1)).toBeNull();
  });
});
