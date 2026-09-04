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

  it("counts orders through EVERY name the product has answered to", async () => {
    /*
     * UPDATED. This asserted `{ "items.slug": { equals: <current slug> } }`,
     * which was the hole: an order line snapshots the slug at purchase, so
     * renaming the product made the equality fail and the delete go through.
     *
     * The query now matches the current slug, every former slug from the
     * redirect table (whose rows point at the product by ID, so they survive a
     * rename), and the SKU snapshot — which is the only remaining link when a
     * rename happened while the product was unpublished and minted no redirect.
     */
    const { payload, calls } = fakePayload({ ledger: 0, orders: 2 });
    await run(payload).catch(() => undefined);
    const orderCall = calls.find((c) => c.collection === "orders");
    const and = (orderCall?.where as { and: Array<Record<string, unknown>> }).and;

    expect(and).toContainEqual({ status: { in: [...LIVE_ORDER_STATUSES] } });

    const idClause = and.find((c) => "or" in c) as { or: Array<Record<string, unknown>> };
    expect(idClause, "the identifier clause should be an OR").toBeDefined();
    expect(idClause.or).toContainEqual({ "items.slug": { in: ["ferrous-sulphate"] } });
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

/**
 * A rename must not unlock the delete.
 *
 * THE HOLE. Order lines snapshot the product by TEXT — productName, slug, sku —
 * frozen at purchase so history survives the product being retired. There is no
 * product relationship on an order to query instead. The guard therefore counted
 * live orders with `{ "items.slug": { equals: <CURRENT slug> } }`.
 *
 * Rename the product and the current slug no longer equals the snapshot, the
 * count falls to zero, and the guard waves the delete through.
 *
 * WHY IT ONLY BITES `pending`. Stock moves on the transition INTO paid, and that
 * writes a stock-ledger row keyed by `product` — a RELATIONSHIP, i.e. the id,
 * which a rename cannot change. So paid/shipped/delivered were already covered
 * by the ledger half of the guard. A `pending` order has not moved stock yet,
 * has no ledger row, and was protected by the slug match alone.
 *
 * THE FIX. Former slugs are recoverable from `product-slug-redirects`, whose
 * rows point at the product BY ID and are therefore rename-proof themselves —
 * the same table the storefront 301s through. The SKU snapshot is matched too,
 * which catches a rename on a product whose redirect row was never minted
 * (a rename made while unpublished mints nothing).
 *
 * These use a fake that really evaluates the query, so a missed slug genuinely
 * fails to match rather than being asserted about in the abstract.
 */
type OrderDocT = { status: string; items: Array<{ slug?: string; sku?: string }> };

function storePayload(opts: {
  product: { name?: string; slug?: string; sku?: string };
  orders?: OrderDocT[];
  redirects?: Array<{ oldSlug: string; product: string }>;
  ledger?: number;
}) {
  const orders = opts.orders ?? [];
  const redirects = opts.redirects ?? [];

  /** Only the clause shapes this guard actually builds. */
  const lineMatches = (o: OrderDocT, clause: Record<string, unknown>): boolean => {
    const slugC = (clause["items.slug"] as { in?: string[]; equals?: string } | undefined) ?? {};
    const skuC = (clause["items.sku"] as { equals?: string } | undefined) ?? {};
    return o.items.some(
      (it) =>
        (Array.isArray(slugC.in) && slugC.in.includes(it.slug ?? "")) ||
        (slugC.equals !== undefined && it.slug === slugC.equals) ||
        (skuC.equals !== undefined && it.sku === skuC.equals),
    );
  };

  const countOrders = (where: { and?: Array<Record<string, unknown>> }): number => {
    const and = where.and ?? [];
    const statuses =
      (and.find((c) => "status" in c)?.status as { in?: string[] } | undefined)?.in ?? [];
    const idClause =
      and.find((c) => "or" in c || "items.slug" in c || "items.sku" in c) ??
      ({} as Record<string, unknown>);
    const ors = ((idClause as { or?: Array<Record<string, unknown>> }).or ?? [
      idClause,
    ]) as Array<Record<string, unknown>>;
    return orders.filter((o) => statuses.includes(o.status) && ors.some((c) => lineMatches(o, c)))
      .length;
  };

  const payload = {
    findByID: vi.fn(async () => opts.product),
    find: vi.fn(async (args: { collection: string; where?: Record<string, unknown> }) => {
      if (args.collection.includes("slug-redirects")) {
        const want = (args.where?.product as { equals?: string } | undefined)?.equals;
        return { docs: redirects.filter((r) => r.product === want) };
      }
      return { docs: [] };
    }),
    count: vi.fn(async (args: { collection: string; where: never }) => {
      if (args.collection === "stock-ledger") return { totalDocs: opts.ledger ?? 0 };
      if (args.collection === "orders") return { totalDocs: countOrders(args.where) };
      return { totalDocs: 0 };
    }),
  };
  return { payload };
}

describe("a renamed product with order history stays undeletable", () => {
  const PENDING = (slug: string, sku?: string): OrderDocT => ({
    status: "pending",
    items: [{ slug, sku }],
  });

  it("1. a product with NO order history can still be deleted", async () => {
    const { payload } = storePayload({ product: { name: "New", slug: "new", sku: "N-1" } });
    await expect(run(payload, "p1")).resolves.toBeUndefined();
  });

  it("2. a pending order on the CURRENT slug blocks the delete", async () => {
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump", sku: "P-1" },
      orders: [PENDING("pump", "P-1")],
    });
    await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
  });

  it("3. RENAMED after the order — the redirect row keeps the guard honest", async () => {
    // The failing case. The order snapshotted "pump"; the product is now
    // "pump-v2". Only the redirect row, which points at the product BY ID,
    // still connects the two.
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v2", sku: "P-1" },
      orders: [PENDING("pump", "P-1")],
      redirects: [{ oldSlug: "pump", product: "p1" }],
    });
    await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
  });

  it("4. renamed TWICE — every former slug is still matched", async () => {
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v3", sku: "P-1" },
      orders: [PENDING("pump", "P-1")],
      redirects: [
        { oldSlug: "pump", product: "p1" },
        { oldSlug: "pump-v2", product: "p1" },
      ],
    });
    await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
  });

  it("5. renamed with NO redirect row — the SKU snapshot still blocks it", async () => {
    // A rename made while the product was unpublished mints no redirect, so the
    // SKU is the only remaining link. Without it this delete would go through.
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v2", sku: "P-1" },
      orders: [PENDING("pump", "P-1")],
    });
    await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
  });

  it("6. another product's redirect does NOT block this one", async () => {
    // The guard must not become "anything ever renamed is undeletable".
    const { payload } = storePayload({
      product: { name: "Beaker", slug: "beaker", sku: "B-1" },
      orders: [PENDING("pump", "P-1")],
      redirects: [{ oldSlug: "pump", product: "OTHER" }],
    });
    await expect(run(payload, "p1")).resolves.toBeUndefined();
  });

  it("7. a CANCELLED order does not block — only live statuses do", async () => {
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v2", sku: "P-1" },
      orders: [{ status: "cancelled", items: [{ slug: "pump", sku: "P-1" }] }],
      redirects: [{ oldSlug: "pump", product: "p1" }],
    });
    await expect(run(payload, "p1")).resolves.toBeUndefined();
  });

  it.each(["paid", "shipped", "delivered"])(
    "8. a %s order blocks even after a rename",
    async (status) => {
      const { payload } = storePayload({
        product: { name: "Pump", slug: "pump-v2", sku: "P-1" },
        orders: [{ status, items: [{ slug: "pump", sku: "P-1" }] }],
        redirects: [{ oldSlug: "pump", product: "p1" }],
      });
      await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
    },
  );

  it("9. a product with no SKU and no redirects is unaffected", async () => {
    // 63 of 133 live products have no SKU. The guard must not throw on them.
    const { payload } = storePayload({ product: { name: "X", slug: "x" } });
    await expect(run(payload, "p1")).resolves.toBeUndefined();
  });

  it("10. a redirect lookup failure must not open the gate", async () => {
    // Fail CLOSED: if former slugs cannot be read, fall back to what is known
    // rather than silently counting zero.
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v2", sku: "P-1" },
      orders: [PENDING("pump", "P-1")],
    });
    payload.find = vi.fn(async () => {
      throw new Error("redirect table unavailable");
    });
    await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
  });

  it("11. renamed, NO SKU — the redirect table is the only surviving link", async () => {
    /*
     * ISOLATES THE REDIRECT PATH, which the tests above did not.
     *
     * Every case above gives the product a SKU, so the SKU clause caught them
     * even with former slugs disabled — mutation testing showed exactly that:
     * reverting to "current slug only" changed nothing those tests could see.
     *
     * 63 of the 133 live products have no SKU, so this is not a contrived
     * shape. With no SKU and a changed slug, the redirect row is the ONLY thing
     * connecting the order line to the product.
     */
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v2" },
      orders: [{ status: "pending", items: [{ slug: "pump" }] }],
      redirects: [{ oldSlug: "pump", product: "p1" }],
    });
    await expect(run(payload, "p1")).rejects.toThrow(/open order/i);
  });

  it("12. renamed, NO SKU, NO redirect — nothing links them, and the delete proceeds", async () => {
    /*
     * The honest limit of this guard, asserted rather than left implicit.
     *
     * A product with no SKU, renamed while unpublished so no redirect was
     * minted, has no surviving link from the order line back to it. Nothing can
     * recover that association from the data, so the delete is allowed.
     *
     * The exposure is bounded: reaching this state needs a product that was
     * ordered, then unpublished, then renamed, and that never had a SKU. If it
     * ever matters, the fix is a product relationship on the order line, which
     * is a schema change and a migration — not a tweak to this guard.
     */
    const { payload } = storePayload({
      product: { name: "Pump", slug: "pump-v2" },
      orders: [{ status: "pending", items: [{ slug: "pump" }] }],
    });
    await expect(run(payload, "p1")).resolves.toBeUndefined();
  });
});
