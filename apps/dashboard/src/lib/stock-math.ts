/**
 * The arithmetic of a stock movement, as a pure function.
 *
 * WHY THIS EXISTS. `collections/StockLedger.ts` describes a correct append-only
 * ledger — append-only enforced, before/after quantities recorded — but nothing
 * in either application ever wrote to it. A search for "stock-ledger" across
 * both apps returned only the collection's own definition, and `stockQty` /
 * `reservedStock` were never written by any code at all: a paid order did not
 * decrement stock, a cancellation restored nothing, and the storefront never
 * consulted it. The shop could oversell without limit and leave no trace.
 *
 * The decision of what a movement does to the numbers is separated from the
 * writing of it so it can be tested exhaustively in the repo's node test runner,
 * which has no database. `lib/stock.ts` performs the writes.
 *
 * TWO INVARIANTS THIS ENFORCES
 *  1. Direction lives in the movement TYPE, never in the sign of the quantity.
 *     A quantity is always a positive magnitude, so a "stock out of -5" cannot
 *     quietly become a stock increase.
 *  2. Neither counter may go negative, and you cannot reserve stock you do not
 *     have. Refusing is always better than recording an impossible position.
 */

export type MovementType =
  | "stock-in"
  | "stock-out"
  | "reserved"
  | "released"
  | "adjustment"
  | "damaged"
  | "returned";

export type StockState = {
  stockQty: number;
  reservedStock: number;
};

export type StockOutcome =
  | { ok: true; next: StockState }
  | { ok: false; error: string };

/** Stock that can still be sold: on hand, less what is already spoken for. */
export function availableStock(state: StockState): number {
  return Math.max(0, state.stockQty - state.reservedStock);
}

/** Movements that add to what is on hand. */
const INCREASES: ReadonlySet<MovementType> = new Set(["stock-in", "returned"]);
/** Movements that take from what is on hand. */
const DECREASES: ReadonlySet<MovementType> = new Set(["stock-out", "damaged"]);

function normalise(state: Partial<StockState> | null | undefined): StockState {
  // A product that has never been counted has no numbers on it yet; treat that
  // as zero rather than NaN, or the first movement poisons the record.
  const stockQty = Number(state?.stockQty);
  const reservedStock = Number(state?.reservedStock);
  return {
    stockQty: Number.isFinite(stockQty) ? stockQty : 0,
    reservedStock: Number.isFinite(reservedStock) ? reservedStock : 0,
  };
}

function invalidQuantity(quantity: number): string | null {
  if (!Number.isFinite(quantity)) return "Quantity must be a number.";
  if (!Number.isInteger(quantity)) return "Quantity must be a whole number.";
  if (quantity <= 0) return "Quantity must be greater than zero — the movement type carries the direction.";
  return null;
}

/**
 * Apply a directional movement.
 *
 * `adjustment` is deliberately NOT accepted here: a correction is a recount, not
 * a direction, and it goes through `applyRecount` so the ledger records what was
 * actually counted rather than a delta someone worked out in their head.
 */
export function applyMovement(
  current: Partial<StockState> | null | undefined,
  movementType: MovementType,
  quantity: number
): StockOutcome {
  const state = normalise(current);

  const bad = invalidQuantity(quantity);
  if (bad) return { ok: false, error: bad };

  if (movementType === "adjustment") {
    return { ok: false, error: "Use applyRecount for an adjustment — it records the counted quantity." };
  }

  if (INCREASES.has(movementType)) {
    return { ok: true, next: { ...state, stockQty: state.stockQty + quantity } };
  }

  if (DECREASES.has(movementType)) {
    const nextQty = state.stockQty - quantity;
    if (nextQty < 0) {
      return {
        ok: false,
        error: `Cannot remove ${quantity} — only ${state.stockQty} in stock.`,
      };
    }
    // Taking stock out from under a reservation would leave more reserved than
    // exists, which is the position that lets a shop promise what it cannot ship.
    if (nextQty < state.reservedStock) {
      return {
        ok: false,
        error: `Cannot remove ${quantity} — ${state.reservedStock} of ${state.stockQty} is reserved. Release the reservation first.`,
      };
    }
    return { ok: true, next: { ...state, stockQty: nextQty } };
  }

  if (movementType === "reserved") {
    const nextReserved = state.reservedStock + quantity;
    if (nextReserved > state.stockQty) {
      return {
        ok: false,
        error: `Cannot reserve ${quantity} — only ${availableStock(state)} available.`,
      };
    }
    return { ok: true, next: { ...state, reservedStock: nextReserved } };
  }

  if (movementType === "released") {
    const nextReserved = state.reservedStock - quantity;
    if (nextReserved < 0) {
      return {
        ok: false,
        error: `Cannot release ${quantity} — only ${state.reservedStock} is reserved.`,
      };
    }
    return { ok: true, next: { ...state, reservedStock: nextReserved } };
  }

  return { ok: false, error: `Unknown movement type "${movementType}".` };
}

/**
 * A physical recount: the shelf says `countedQty`, so that is what the record
 * should say. Returns the movement to store as well as the next state, because
 * the ledger's `quantity` for an adjustment is the SIZE of the correction while
 * previous/new carry the direction.
 */
export function applyRecount(
  current: Partial<StockState> | null | undefined,
  countedQty: number
): StockOutcome & { quantity?: number } {
  const state = normalise(current);

  if (!Number.isFinite(countedQty)) return { ok: false, error: "Counted quantity must be a number." };
  if (!Number.isInteger(countedQty)) return { ok: false, error: "Counted quantity must be a whole number." };
  if (countedQty < 0) return { ok: false, error: "Counted quantity cannot be negative." };

  if (countedQty < state.reservedStock) {
    return {
      ok: false,
      error: `Counted ${countedQty} but ${state.reservedStock} is reserved. Release the reservation before recounting this low.`,
    };
  }

  return {
    ok: true,
    next: { ...state, stockQty: countedQty },
    quantity: Math.abs(countedQty - state.stockQty),
  };
}

/**
 * Which stock movement, if any, an order status change implies.
 *
 * Kept here rather than inside the hook so the rule can be exercised over every
 * pair of statuses. The order lifecycle is
 * pending -> paid -> shipped -> delivered, with cancelled/refunded reachable
 * from several points, so "did the goods leave the shelf" is not simply
 * "is the status paid".
 */
const CONSUMED_STATUSES: ReadonlySet<string> = new Set(["paid", "shipped", "delivered"]);
const RESTORING_STATUSES: ReadonlySet<string> = new Set(["cancelled", "refunded"]);

export function stockMovementForTransition(
  from: string,
  to: string
): "stock-out" | "returned" | null {
  if (from === to) return null;
  // Entering the consumed band for the first time takes the goods out. Moving
  // paid -> shipped -> delivered must NOT decrement again.
  if (CONSUMED_STATUSES.has(to) && !CONSUMED_STATUSES.has(from)) return "stock-out";
  // Coming back out of it hands them back. Cancelling something that was never
  // paid returns nothing, because nothing was taken.
  if (RESTORING_STATUSES.has(to) && CONSUMED_STATUSES.has(from)) return "returned";
  return null;
}
