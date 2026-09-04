import { describe, it, expect } from "vitest";
import {
  applyMovement,
  applyRecount,
  availableStock,
  stockMovementForTransition,
  preserveStockFields,
  type MovementType,
  type StockState,
} from "../apps/dashboard/src/lib/stock-math";

/**
 * Inventory arithmetic.
 *
 * The ledger collection was correct and completely unwired — nothing in either
 * application wrote a stock movement, and `stockQty` / `reservedStock` were
 * never written by any code, so a paid order decremented nothing and the shop
 * could oversell silently. These tests pin the rules the write path enforces.
 */

const at = (stockQty: number, reservedStock = 0): StockState => ({ stockQty, reservedStock });

const ok = (r: ReturnType<typeof applyMovement>) => {
  if (!r.ok) throw new Error(`expected success, got: ${r.error}`);
  return r.next;
};

describe("availableStock", () => {
  it("is what is on hand less what is spoken for", () => {
    expect(availableStock(at(10, 3))).toBe(7);
    expect(availableStock(at(10, 0))).toBe(10);
  });

  it("never reports a negative availability", () => {
    expect(availableStock(at(2, 5))).toBe(0);
  });
});

describe("direction comes from the movement type, never the sign", () => {
  // The trap this closes: "stock-out of -5" quietly becoming a stock increase.
  const types: MovementType[] = ["stock-in", "stock-out", "reserved", "released", "damaged", "returned"];

  it("rejects a negative quantity for every movement type", () => {
    for (const t of types) {
      const r = applyMovement(at(100, 10), t, -5);
      expect(r.ok, `${t} must reject a negative quantity`).toBe(false);
    }
  });

  it("rejects zero, fractions and non-numbers", () => {
    for (const bad of [0, 2.5, NaN, Infinity]) {
      expect(applyMovement(at(100), "stock-in", bad).ok, `quantity ${bad}`).toBe(false);
    }
  });
});

describe("movements that change what is on hand", () => {
  it("stock-in and returned add", () => {
    expect(ok(applyMovement(at(10), "stock-in", 5)).stockQty).toBe(15);
    expect(ok(applyMovement(at(10), "returned", 2)).stockQty).toBe(12);
  });

  it("stock-out and damaged subtract", () => {
    expect(ok(applyMovement(at(10), "stock-out", 4)).stockQty).toBe(6);
    expect(ok(applyMovement(at(10), "damaged", 1)).stockQty).toBe(9);
  });

  it("refuses to drive stock negative", () => {
    const r = applyMovement(at(3), "stock-out", 4);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/only 3 in stock/);
  });

  it("allows taking exactly what is there", () => {
    expect(ok(applyMovement(at(3), "stock-out", 3)).stockQty).toBe(0);
  });

  it("refuses to ship stock out from under a reservation", () => {
    // 10 on hand, 8 reserved for orders already placed. Removing 5 would leave
    // 5 on hand against 8 promised — the position that lets a shop promise what
    // it cannot ship.
    const r = applyMovement(at(10, 8), "stock-out", 5);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/8 of 10 is reserved/);
  });

  it("leaves reservations untouched when stock moves", () => {
    expect(ok(applyMovement(at(10, 2), "stock-in", 5)).reservedStock).toBe(2);
  });
});

describe("reservations", () => {
  it("reserves against available stock", () => {
    const next = ok(applyMovement(at(10, 2), "reserved", 3));
    expect(next).toEqual({ stockQty: 10, reservedStock: 5 });
  });

  it("cannot reserve more than is available", () => {
    const r = applyMovement(at(10, 8), "reserved", 3);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/only 2 available/);
  });

  it("can reserve exactly the remaining availability", () => {
    expect(ok(applyMovement(at(10, 8), "reserved", 2)).reservedStock).toBe(10);
  });

  it("releases back", () => {
    expect(ok(applyMovement(at(10, 5), "released", 2)).reservedStock).toBe(3);
  });

  it("cannot release more than is reserved", () => {
    const r = applyMovement(at(10, 1), "released", 2);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/only 1 is reserved/);
  });

  it("reserving never changes what is on hand", () => {
    expect(ok(applyMovement(at(10), "reserved", 4)).stockQty).toBe(10);
    expect(ok(applyMovement(at(10, 4), "released", 4)).stockQty).toBe(10);
  });
});

describe("a product that has never been counted", () => {
  it("treats missing numbers as zero rather than NaN", () => {
    expect(ok(applyMovement(undefined, "stock-in", 5))).toEqual({ stockQty: 5, reservedStock: 0 });
    expect(ok(applyMovement({}, "stock-in", 5)).stockQty).toBe(5);
    expect(ok(applyMovement({ stockQty: undefined }, "stock-in", 2)).stockQty).toBe(2);
  });

  it("still refuses to go negative from nothing", () => {
    expect(applyMovement(null, "stock-out", 1).ok).toBe(false);
  });
});

describe("recount", () => {
  it("sets stock to what was actually counted", () => {
    const r = applyRecount(at(10, 2), 7);
    expect(r.ok).toBe(true);
    expect(r.ok === true && r.next).toEqual({ stockQty: 7, reservedStock: 2 });
  });

  it("reports the SIZE of the correction, in either direction", () => {
    expect(applyRecount(at(10), 7).quantity).toBe(3);
    expect(applyRecount(at(10), 14).quantity).toBe(4);
  });

  it("a recount to the same number is still valid, and is a zero-size movement", () => {
    const r = applyRecount(at(10), 10);
    expect(r.ok).toBe(true);
    expect(r.quantity).toBe(0);
  });

  it("cannot count below what is already reserved", () => {
    const r = applyRecount(at(10, 8), 5);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/8 is reserved/);
  });

  it("rejects negative and fractional counts", () => {
    expect(applyRecount(at(10), -1).ok).toBe(false);
    expect(applyRecount(at(10), 1.5).ok).toBe(false);
    expect(applyRecount(at(10), NaN).ok).toBe(false);
  });

  it("counting to zero is allowed when nothing is reserved", () => {
    const r = applyRecount(at(10), 0);
    expect(r.ok).toBe(true);
    expect(r.ok === true && r.next.stockQty).toBe(0);
  });
});

describe("adjustment is not a direction", () => {
  it("applyMovement refuses it and points at the recount path", () => {
    const r = applyMovement(at(10), "adjustment", 3);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/applyRecount/);
  });
});

describe("a sequence of movements stays coherent", () => {
  it("reserve, ship, release mirrors a real order", () => {
    let s: StockState = at(20);
    s = ok(applyMovement(s, "reserved", 5)); // order placed
    expect(availableStock(s)).toBe(15);
    s = ok(applyMovement(s, "released", 5)); // reservation converts to a shipment
    s = ok(applyMovement(s, "stock-out", 5));
    expect(s).toEqual({ stockQty: 15, reservedStock: 0 });
    s = ok(applyMovement(s, "returned", 2)); // customer sends two back
    expect(s.stockQty).toBe(17);
  });

  it("never lets a sequence reach an impossible position", () => {
    let s: StockState = at(5);
    s = ok(applyMovement(s, "reserved", 5));
    // everything is spoken for: no further reservation, no shipping around it
    expect(applyMovement(s, "reserved", 1).ok).toBe(false);
    expect(applyMovement(s, "stock-out", 1).ok).toBe(false);
    expect(availableStock(s)).toBe(0);
  });
});

describe("which order transitions move stock", () => {
  const STATUSES = ["pending", "paid", "failed", "shipped", "delivered", "cancelled", "refunded"];

  it("takes stock out exactly once, when the order first becomes paid", () => {
    expect(stockMovementForTransition("pending", "paid")).toBe("stock-out");
  });

  it("does NOT decrement again as the order progresses", () => {
    // The bug this prevents: paid -> shipped -> delivered removing the goods
    // three times over.
    expect(stockMovementForTransition("paid", "shipped")).toBeNull();
    expect(stockMovementForTransition("shipped", "delivered")).toBeNull();
    expect(stockMovementForTransition("paid", "delivered")).toBeNull();
  });

  it("returns the goods when a consumed order is cancelled or refunded", () => {
    for (const from of ["paid", "shipped", "delivered"]) {
      for (const to of ["cancelled", "refunded"]) {
        expect(stockMovementForTransition(from, to), `${from} -> ${to}`).toBe("returned");
      }
    }
  });

  it("returns nothing when an order that never took stock is cancelled", () => {
    // Nothing was removed, so nothing may be handed back — otherwise cancelling
    // an unpaid order invents inventory.
    expect(stockMovementForTransition("pending", "cancelled")).toBeNull();
    expect(stockMovementForTransition("failed", "cancelled")).toBeNull();
    expect(stockMovementForTransition("pending", "failed")).toBeNull();
  });

  it("a re-save with no status change moves nothing", () => {
    for (const s of STATUSES) expect(stockMovementForTransition(s, s), s).toBeNull();
  });

  it("re-entering the consumed band after a refund takes stock again", () => {
    // refunded -> paid is a recovery: the goods leave the shelf a second time.
    expect(stockMovementForTransition("refunded", "paid")).toBe("stock-out");
    expect(stockMovementForTransition("cancelled", "paid")).toBe("stock-out");
  });

  it("every pair resolves to exactly one of the three outcomes", () => {
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        const r = stockMovementForTransition(from, to);
        expect([null, "stock-out", "returned"], `${from} -> ${to} gave ${r}`).toContain(r);
      }
    }
  });

  it("is never both directions for the same pair", () => {
    // Sanity on the rule's shape: a transition cannot consume and restore.
    const outs = STATUSES.flatMap((f) => STATUSES.map((t) => stockMovementForTransition(f, t)));
    expect(outs.filter((o) => o === "stock-out").length).toBeGreaterThan(0);
    expect(outs.filter((o) => o === "returned").length).toBeGreaterThan(0);
  });
});

describe("a document save cannot move stock", () => {
  /**
   * The bypass: `stockQty` and `reservedStock` were ordinary editable fields, so
   * typing a number and pressing Save wrote past the ledger — no row, no reason,
   * no author. And because a save rewrites the whole document from a snapshot
   * the browser read minutes ago, it could silently undo a movement made in
   * between.
   */
  it("keeps the stored value and reports the discarded attempt", () => {
    const r = preserveStockFields({ stockQty: 500 }, { stockQty: 12 });
    expect(r.preserve.stockQty).toBe(12);
    expect(r.discarded).toEqual([{ field: "stockQty", attempted: 500, kept: 12 }]);
  });

  it("pins the field even when the value already matches", () => {
    // Pinning unconditionally is what makes the field immutable through this
    // path, rather than merely usually-equal to the stored value.
    const r = preserveStockFields({ stockQty: 12 }, { stockQty: 12 });
    expect(r.preserve.stockQty).toBe(12);
    expect(r.discarded).toEqual([]);
  });

  it("leaves a field alone when the save does not mention it", () => {
    // A patch that only changes the price must not rewrite stock at all.
    const r = preserveStockFields({ name: "x" } as Record<string, unknown>, { stockQty: 12 });
    expect(r.preserve).toEqual({});
    expect(r.discarded).toEqual([]);
  });

  it("guards reservedStock the same way", () => {
    const r = preserveStockFields({ reservedStock: 99 }, { reservedStock: 3 });
    expect(r.preserve.reservedStock).toBe(3);
    expect(r.discarded).toEqual([{ field: "reservedStock", attempted: 99, kept: 3 }]);
  });

  it("treats a cleared field as an attempt to set zero", () => {
    const r = preserveStockFields({ stockQty: null }, { stockQty: 7 });
    expect(r.preserve.stockQty).toBe(7);
    expect(r.discarded).toEqual([{ field: "stockQty", attempted: 0, kept: 7 }]);
  });

  it("survives a product that has never been counted", () => {
    const r = preserveStockFields({ stockQty: 5 }, {});
    expect(r.preserve.stockQty).toBe(0);
    expect(r.discarded).toEqual([{ field: "stockQty", attempted: 5, kept: 0 }]);
  });

  it("does not choke on a non-numeric attempt", () => {
    const r = preserveStockFields({ stockQty: "lots" as unknown as number }, { stockQty: 4 });
    expect(r.preserve.stockQty).toBe(4);
    expect(r.discarded[0]?.attempted).toBe(0);
  });

  it("DISCARDS rather than refuses, so a stale draft can still be published", () => {
    // The reason this is not a rejection. Drafts snapshot every field. Sell one
    // unit and the published stock moves; a draft taken beforehand still holds
    // the old number. Refusing the mismatch would mean any stock movement
    // permanently blocked publishing any older draft — an error the editor
    // cannot clear and did not cause.
    const staleDraft = { stockQty: 10, name: "Widget" };
    const afterASale = { stockQty: 9 };
    const r = preserveStockFields(staleDraft, afterASale);
    // No throw, and the publish carries the authoritative figure.
    expect(r.preserve.stockQty).toBe(9);
    expect(r.discarded).toHaveLength(1);
  });

  it("both fields at once", () => {
    const r = preserveStockFields(
      { stockQty: 1, reservedStock: 1 },
      { stockQty: 40, reservedStock: 6 },
    );
    expect(r.preserve).toEqual({ stockQty: 40, reservedStock: 6 });
    expect(r.discarded.map((d) => d.field).sort()).toEqual(["reservedStock", "stockQty"]);
  });
});
