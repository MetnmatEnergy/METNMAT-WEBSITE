import type { Payload, PayloadRequest } from "payload";
import { applyMovement, applyRecount, type MovementType, type StockState } from "./stock-math";

/**
 * The one place stock changes.
 *
 * `collections/StockLedger.ts` was a correct append-only ledger that nothing
 * wrote to: a search for "stock-ledger" across both applications returned only
 * the collection's own definition, and `stockQty` / `reservedStock` were never
 * written by any code. A paid order decremented nothing, a cancellation restored
 * nothing, and the shop could oversell in silence.
 *
 * Every movement now goes through here, and every movement leaves a row.
 *
 * HOW THE RACE IS CLOSED. Two people adjusting the same product at once must not
 * lose one another's write. Rather than read-modify-write, the change is issued
 * as a single atomic `findOneAndUpdate` whose FILTER carries the business rule:
 * a stock-out only matches a document that still has enough stock. If the filter
 * does not match, nothing is written and no ledger row is created — the caller
 * gets a precise reason instead of a silently impossible position.
 *
 * `$inc` also treats a missing field as zero, which matters because products
 * created before inventory existed have no `stockQty` at all.
 *
 * The ledger row and the product update are committed together in a transaction
 * where the deployment supports one, with the same standalone-Mongo fallback the
 * chatbot sync already uses.
 */

export type StockMovementInput = {
  productId: string;
  /** Directional movement. Use `recountStock` for a physical recount. */
  movementType: Exclude<MovementType, "adjustment">;
  /** Positive magnitude. Direction comes from `movementType`. */
  quantity: number;
  reason?: string;
  relatedOrder?: string;
  relatedEnquiry?: string;
  /** Staff member responsible. Omitted for automated movements. */
  userId?: string;
};

export type StockResult =
  | { ok: true; previous: StockState; next: StockState; ledgerId: string | null }
  | { ok: false; error: string };

// ── minimal native-driver surface, matching hooks/sync-chatbot.ts ────────────
type RawSession = {
  withTransaction(fn: () => Promise<unknown>): Promise<unknown>;
  endSession(): Promise<void>;
};
type RawDoc = Record<string, unknown> | null;
type RawCollection = {
  findOneAndUpdate(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    opts?: Record<string, unknown>
  ): Promise<RawDoc | { value?: RawDoc }>;
  findOne(filter: Record<string, unknown>, opts?: Record<string, unknown>): Promise<RawDoc>;
};
type RawConnection = {
  startSession?: () => RawSession;
  collection?: (name: string) => RawCollection;
  db?: { collection: (name: string) => RawCollection };
};

function connection(payload: Payload): RawConnection | null {
  const db = payload.db as unknown as { connection?: RawConnection } | undefined;
  return db?.connection ?? null;
}

function productsCollection(conn: RawConnection): RawCollection | null {
  if (typeof conn.collection === "function") return conn.collection("products");
  if (conn.db) return conn.db.collection("products");
  return null;
}

/** Mongo driver versions differ on whether the doc is returned bare or wrapped. */
function unwrap(res: RawDoc | { value?: RawDoc }): RawDoc {
  if (res && typeof res === "object" && "value" in res) return (res as { value?: RawDoc }).value ?? null;
  return res as RawDoc;
}

function isTxnUnsupported(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  return /Transaction numbers are only allowed|replica set|Transactions are not supported/i.test(msg);
}

function stateOf(doc: RawDoc): StockState {
  return {
    stockQty: Number(doc?.stockQty) || 0,
    reservedStock: Number(doc?.reservedStock) || 0,
  };
}

/**
 * The filter that makes each movement safe under concurrency, and the update
 * that applies it. The filter is the rule: if it does not match, the movement
 * was not permissible at the moment it was attempted.
 */
export function planUpdate(
  movementType: StockMovementInput["movementType"],
  quantity: number
): { guard: Record<string, unknown>; update: Record<string, unknown> } | null {
  switch (movementType) {
    case "stock-in":
    case "returned":
      return { guard: {}, update: { $inc: { stockQty: quantity } } };

    case "stock-out":
    case "damaged":
      return {
        // Enough on hand, AND enough left afterwards to honour reservations.
        guard: {
          $expr: {
            $gte: [{ $subtract: [{ $ifNull: ["$stockQty", 0] }, quantity] }, { $ifNull: ["$reservedStock", 0] }],
          },
        },
        update: { $inc: { stockQty: -quantity } },
      };

    case "reserved":
      return {
        guard: {
          $expr: {
            $lte: [{ $add: [{ $ifNull: ["$reservedStock", 0] }, quantity] }, { $ifNull: ["$stockQty", 0] }],
          },
        },
        update: { $inc: { reservedStock: quantity } },
      };

    case "released":
      return {
        guard: { $expr: { $gte: [{ $ifNull: ["$reservedStock", 0] }, quantity] } },
        update: { $inc: { reservedStock: -quantity } },
      };

    default:
      return null;
  }
}

async function appendLedger(
  payload: Payload,
  req: PayloadRequest | undefined,
  input: {
    productId: string;
    movementType: MovementType;
    quantity: number;
    previous: StockState;
    next: StockState;
    reason?: string;
    relatedOrder?: string;
    relatedEnquiry?: string;
    userId?: string;
  }
): Promise<string | null> {
  const created = await payload.create({
    collection: "stock-ledger",
    // The service IS the authority here; it has already enforced the rules that
    // the collection's own access control exists to protect. An automated
    // movement (a webhook marking an order paid) has no logged-in user.
    overrideAccess: true,
    ...(req ? { req } : {}),
    data: {
      product: input.productId,
      movementType: input.movementType,
      quantity: input.quantity,
      previousQuantity: input.previous.stockQty,
      newQuantity: input.next.stockQty,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.relatedOrder ? { relatedOrder: input.relatedOrder } : {}),
      ...(input.relatedEnquiry ? { relatedEnquiry: input.relatedEnquiry } : {}),
      ...(input.userId ? { createdBy: input.userId } : {}),
    } as never,
  });
  return created?.id ? String(created.id) : null;
}

/**
 * Record where a newly created product's count started.
 *
 * Deliberately does NOT go through `recordStockMovement`. A create has already
 * written `stockQty` by the time any hook can see the document, so applying a
 * `stock-in` of the same amount would `$inc` it a second time and leave the
 * product holding double what was entered. The quantity is not being applied
 * here — it is already applied — only recorded, so the ledger reconciles
 * against the product from its first row rather than starting mid-story.
 *
 * Returns null rather than throwing: a product is real whether or not its
 * opening row was written, and losing the create over an audit row would be a
 * poor trade.
 */
export async function recordOpeningBalance(
  payload: Payload,
  input: { productId: string; quantity: number; userId?: string },
  req?: PayloadRequest
): Promise<string | null> {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return null;
  const zero: StockState = { stockQty: 0, reservedStock: 0 };
  return appendLedger(payload, req, {
    productId: input.productId,
    movementType: "stock-in",
    quantity: input.quantity,
    previous: zero,
    next: { stockQty: input.quantity, reservedStock: 0 },
    reason: "Opening balance (product created)",
    ...(input.userId ? { userId: input.userId } : {}),
  });
}

/**
 * Why the movement was refused, phrased for the person who attempted it.
 *
 * Reached only when the atomic filter did not match, so the document is re-read
 * to say what the position actually was. The pure module owns the wording so the
 * message a user sees is the same one the unit tests pin.
 */
async function explainRefusal(
  col: RawCollection,
  objectId: unknown,
  movementType: StockMovementInput["movementType"],
  quantity: number
): Promise<string> {
  const doc = await col.findOne({ _id: objectId });
  if (!doc) return "Product not found.";
  const outcome = applyMovement(stateOf(doc), movementType, quantity);
  return outcome.ok
    ? "Stock changed while this movement was being applied. Try again."
    : outcome.error;
}

/** Convert a Payload id string to whatever the driver expects for `_id`. */
function toObjectId(payload: Payload, id: string): unknown {
  const ctor = (payload.db as unknown as { connection?: { base?: { Types?: { ObjectId?: new (v: string) => unknown } } } })
    ?.connection?.base?.Types?.ObjectId;
  if (ctor) {
    try {
      return new ctor(id);
    } catch {
      /* not a valid ObjectId — fall through and use the raw string */
    }
  }
  return id;
}

/**
 * The stock this product actually holds, read from the `products` collection.
 *
 * This is the same document every movement above writes, and that is the entire
 * point. Anything that needs the current count must ask this document rather
 * than a version snapshot: the movements here go through the native driver
 * specifically so Payload cannot see them, which also means they mint no
 * version. A snapshot can therefore be arbitrarily far behind the truth and has
 * no way to notice.
 *
 * Returns null rather than a zeroed state when the count cannot be established —
 * the driver is unreachable, or there is no such document. Zero is a real stock
 * level and must never be invented; a caller that gets null still knows it was
 * not told an answer.
 */
export async function readAuthoritativeStock(
  payload: Payload,
  productId: string
): Promise<StockState | null> {
  const conn = connection(payload);
  if (!conn) return null;

  const col = productsCollection(conn);
  if (!col) return null;

  const doc = await col.findOne({ _id: toObjectId(payload, productId) });
  return doc ? stateOf(doc) : null;
}

/**
 * Apply a directional stock movement and record it.
 *
 * Returns `{ ok: false, error }` rather than throwing for business refusals —
 * "not enough stock" is an expected answer, not an exception — so callers can
 * surface it. Genuine infrastructure failures still throw.
 */
export async function recordStockMovement(
  payload: Payload,
  input: StockMovementInput,
  req?: PayloadRequest
): Promise<StockResult> {
  const { productId, movementType, quantity } = input;

  // Pre-flight on the pure rules so obviously invalid input never reaches Mongo
  // and the caller gets the same wording the tests pin.
  const shape = applyMovement({ stockQty: Number.MAX_SAFE_INTEGER, reservedStock: 0 }, movementType, quantity);
  if (!shape.ok && !/only|reserved/i.test(shape.error)) return { ok: false, error: shape.error };

  const conn = connection(payload);
  const col = conn ? productsCollection(conn) : null;
  if (!conn || !col) return { ok: false, error: "Inventory storage is unavailable." };

  const plan = planUpdate(movementType, quantity);
  if (!plan) return { ok: false, error: `Unknown movement type "${movementType}".` };

  const _id = toObjectId(payload, productId);
  const filter = { _id, ...plan.guard };

  let previous: StockState | null = null;
  let next: StockState | null = null;
  let ledgerId: string | null = null;

  const apply = async (session?: RawSession) => {
    const before = unwrap(
      await col.findOneAndUpdate(filter, plan.update, {
        returnDocument: "before",
        ...(session ? { session } : {}),
      })
    );
    if (!before) return; // guard did not match — left null, explained below
    previous = stateOf(before);
    const computed = applyMovement(previous, movementType, quantity);
    next = computed.ok ? computed.next : previous;
    ledgerId = await appendLedger(payload, req, {
      productId,
      movementType,
      quantity,
      previous,
      next,
      reason: input.reason,
      relatedOrder: input.relatedOrder,
      relatedEnquiry: input.relatedEnquiry,
      userId: input.userId,
    });
  };

  const session = typeof conn.startSession === "function" ? conn.startSession() : null;
  if (session) {
    try {
      await session.withTransaction(() => apply(session));
    } catch (err) {
      if (!isTxnUnsupported(err)) throw err;
      await apply();
    } finally {
      await session.endSession();
    }
  } else {
    await apply();
  }

  if (!previous || !next) {
    return { ok: false, error: await explainRefusal(col, _id, movementType, quantity) };
  }
  return { ok: true, previous, next, ledgerId };
}

/**
 * A physical recount. Sets stock to what was counted and records the size of the
 * correction, refusing to count below what is already reserved.
 */
export async function recountStock(
  payload: Payload,
  input: {
    productId: string;
    countedQty: number;
    reason?: string;
    userId?: string;
  },
  req?: PayloadRequest
): Promise<StockResult> {
  const conn = connection(payload);
  const col = conn ? productsCollection(conn) : null;
  if (!conn || !col) return { ok: false, error: "Inventory storage is unavailable." };

  const guardOnly = applyRecount({ stockQty: 0, reservedStock: 0 }, input.countedQty);
  if (!guardOnly.ok) return { ok: false, error: guardOnly.error };

  const _id = toObjectId(payload, input.productId);
  const filter = {
    _id,
    // Never record a count that is already promised away.
    $expr: { $lte: [{ $ifNull: ["$reservedStock", 0] }, input.countedQty] },
  };

  let previous: StockState | null = null;
  let next: StockState | null = null;
  let ledgerId: string | null = null;

  const apply = async (session?: RawSession) => {
    const before = unwrap(
      await col.findOneAndUpdate(
        filter,
        { $set: { stockQty: input.countedQty } },
        { returnDocument: "before", ...(session ? { session } : {}) }
      )
    );
    if (!before) return;
    previous = stateOf(before);
    const computed = applyRecount(previous, input.countedQty);
    next = computed.ok ? computed.next : previous;
    ledgerId = await appendLedger(payload, req, {
      productId: input.productId,
      movementType: "adjustment",
      quantity: computed.quantity ?? Math.abs(input.countedQty - previous.stockQty),
      previous,
      next,
      reason: input.reason,
      userId: input.userId,
    });
  };

  const session = typeof conn.startSession === "function" ? conn.startSession() : null;
  if (session) {
    try {
      await session.withTransaction(() => apply(session));
    } catch (err) {
      if (!isTxnUnsupported(err)) throw err;
      await apply();
    } finally {
      await session.endSession();
    }
  } else {
    await apply();
  }

  if (!previous || !next) {
    const doc = await col.findOne({ _id });
    if (!doc) return { ok: false, error: "Product not found." };
    const outcome = applyRecount(stateOf(doc), input.countedQty);
    return { ok: false, error: outcome.ok ? "Stock changed while recounting. Try again." : outcome.error };
  }
  return { ok: true, previous, next, ledgerId };
}
