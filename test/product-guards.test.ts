import { describe, it, expect, vi } from "vitest";
import {
  productDeleteBlocker,
  productBeforeDelete,
  LIVE_ORDER_STATUSES,
} from "../apps/dashboard/src/hooks/product-guards";

/**
 * A product may not be deleted out from under its own stock history.
 *
 * `StockLedger.product` is a REQUIRED relationship in a collection whose access
 * forbids update AND delete, so deleting the product orphans every movement row
 * permanently — unreadable and unremovable by any member of staff. And
 * `Orders.items` snapshots the product by SLUG rather than holding a
 * relationship, so an order still in flight silently stops moving stock once the
 * product it names is gone.
 */

describe("productDeleteBlocker", () => {
  it("permits deleting a product that never moved stock and is on no live order", () => {
    expect(productDeleteBlocker({ ledgerRows: 0, liveOrders: 0 })).toBeNull();
  });

  it("blocks while the stock ledger still points at it", () => {
    const msg = productDeleteBlocker({ ledgerRows: 7, liveOrders: 0, name: "Ferrous Sulphate" })!;
    expect(msg).toContain("Ferrous Sulphate");
    expect(msg).toContain("7 order-linked stock movements");
    expect(msg).toMatch(/append-only/);
    expect(msg).toMatch(/[Uu]npublish/);
  });

  it("blocks while live orders still name it", () => {
    const msg = productDeleteBlocker({ ledgerRows: 0, liveOrders: 2, name: "Ag/AgCl Electrode" })!;
    expect(msg).toContain("2 open orders");
    expect(msg).toMatch(/Finish or cancel/);
  });

  it("names both obstacles when both are present", () => {
    const msg = productDeleteBlocker({ ledgerRows: 3, liveOrders: 1, name: "Cells" })!;
    expect(msg).toContain("3 order-linked stock movements");
    expect(msg).toContain("1 open order");
  });

  it("gets the singular right — '1 stock movements' reads as a bug", () => {
    expect(productDeleteBlocker({ ledgerRows: 1, liveOrders: 0 })).toContain("1 order-linked stock movement.");
    expect(productDeleteBlocker({ ledgerRows: 0, liveOrders: 1 })).toContain("1 open order.");
  });

  it("still says something useful without a product name", () => {
    expect(productDeleteBlocker({ ledgerRows: 4, liveOrders: 0, name: null })).toMatch(
      /^This product/,
    );
  });

  it("treats negative or nonsense counts as nothing blocking", () => {
    expect(productDeleteBlocker({ ledgerRows: -1, liveOrders: 0 })).toBeNull();
  });

  it("offers unpublishing as the alternative, since drafts are enabled on Products", () => {
    expect(productDeleteBlocker({ ledgerRows: 5, liveOrders: 0 })).toMatch(/back to Draft/);
  });
});

type CountArgs = { collection: string; where: unknown };

function fakePayload(opts: {
  product?: { name?: string; slug?: string } | null;
  ledger?: number;
  orders?: number;
}) {
  const calls: CountArgs[] = [];
  const payload = {
    findByID: vi.fn(async () => {
      if (opts.product === null) throw new Error("not found");
      return opts.product ?? { name: "Ferrous Sulphate", slug: "ferrous-sulphate" };
    }),
    count: vi.fn(async (args: CountArgs) => {
      calls.push(args);
      if (args.collection === "stock-ledger") return { totalDocs: opts.ledger ?? 0 };
      if (args.collection === "orders") return { totalDocs: opts.orders ?? 0 };
      return { totalDocs: 0 };
    }),
  };
  return { calls, payload };
}

const run = (payload: unknown, id: string = "p1") =>
  (productBeforeDelete as unknown as (a: unknown) => Promise<void>)({
    req: { payload },
    id,
    collection: {},
    context: {},
  });

describe("productBeforeDelete", () => {
  it("lets a clean product through", async () => {
    const { payload } = fakePayload({ ledger: 0, orders: 0 });
    await expect(run(payload)).resolves.toBeUndefined();
  });

  it("refuses with a message the browser will actually receive", async () => {
    const { payload } = fakePayload({ ledger: 4, orders: 0 });
    // Payload replaces the message of any non-public error with
    // "Something went wrong." — status 400 + isPublic is what stops that.
    const err = (await run(payload).catch((e) => e)) as Error & {
      status?: number;
      isPublic?: boolean;
    };
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.isPublic).toBe(true);
    expect(err.message).toContain("4 order-linked stock movements");
  });

  it("counts the ledger by the relationship id", async () => {
    const { payload, calls } = fakePayload({ ledger: 1 });
    await run(payload, "p1").catch(() => undefined);
    expect(calls).toContainEqual(
      expect.objectContaining({
        collection: "stock-ledger",
        where: { and: [{ product: { equals: "p1" } }, { relatedOrder: { exists: true } }] },
      }),
    );
  });

  it("counts orders through the SLUG path into the items array — there is no product relationship on an order", async () => {
    const { payload, calls } = fakePayload({ ledger: 0, orders: 2 });
    await run(payload).catch(() => undefined);
    const orderCall = calls.find((c) => c.collection === "orders");
    expect(orderCall?.where).toEqual({
      and: [
        { "items.slug": { equals: "ferrous-sulphate" } },
        { status: { in: [...LIVE_ORDER_STATUSES] } },
      ],
    });
  });

  it("treats settled orders as no obstacle — their stock has already moved", () => {
    expect(LIVE_ORDER_STATUSES).not.toContain("cancelled");
    expect(LIVE_ORDER_STATUSES).not.toContain("refunded");
    expect(LIVE_ORDER_STATUSES).not.toContain("failed");
    expect(LIVE_ORDER_STATUSES).toContain("pending");
    expect(LIVE_ORDER_STATUSES).toContain("delivered");
  });

  it("still checks the ledger when the product itself cannot be read", async () => {
    const { payload, calls } = fakePayload({ product: null, ledger: 2 });
    const err = (await run(payload).catch((e) => e)) as Error;
    expect(err.message).toMatch(/^This product/);
    expect(calls.some((c) => c.collection === "orders")).toBe(false);
  });
});

/**
 * The joint state neither plan modelled.
 *
 * This guard and the StockLedger create-lockdown ship in the same commit. With
 * the ledger closed to create, update AND delete, an unqualified
 * `ledgerRows > 0` rule made any product ever given an opening stock figure
 * permanently undeletable — by anyone, including a super-admin, and including a
 * product created by mistake a minute earlier. Nothing could clear the blocking
 * row, because the row itself cannot be deleted.
 *
 * So the rule counts only movements linked to an order. These three cases are
 * the boundary, and they are why the query carries an `and`.
 */
describe("a product nobody has traded stays deletable", () => {
  it("an opening balance alone does not block the delete", async () => {
    // recordOpeningStock writes exactly one such row on create when stockQty > 0,
    // and it carries no relatedOrder — so the narrowed query does not see it.
    const { payload } = fakePayload({ ledger: 0, orders: 0, product: { name: "Mistyped" } });
    await expect(run(payload, "p9")).resolves.toBeUndefined();
  });

  it("the query asks for order-linked rows only", async () => {
    const { payload, calls } = fakePayload({ ledger: 0, orders: 0 });
    await run(payload, "p9");
    const ledgerCall = calls.find((c) => c.collection === "stock-ledger")!;
    expect(ledgerCall.where).toEqual({
      and: [{ product: { equals: "p9" } }, { relatedOrder: { exists: true } }],
    });
  });

  it("but a movement against a real order still protects the history", () => {
    const msg = productDeleteBlocker({ ledgerRows: 1, liveOrders: 0, name: "Sold Item" })!;
    expect(msg).toContain("1 order-linked stock movement");
  });
});
