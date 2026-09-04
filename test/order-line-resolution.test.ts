import { describe, it, expect, vi } from "vitest";

/**
 * Renaming a product's slug silently stopped stock decrementing on orders
 * already in flight.
 *
 * Order lines snapshot the product instead of holding a relationship — a
 * deliberate decision so order history survives a product being retired — but
 * the snapshot was read as though a slug were permanent. Staff fix a typo in a
 * slug, Razorpay confirms payment, the lookup finds nothing, the customer is
 * charged and the shelf is never decremented. These tests pin the resolution
 * order, the refusal to guess, the idempotency guard that must NOT change, and
 * the durable report that replaces a log line nobody reads.
 */

vi.mock("../apps/dashboard/src/lib/stock", () => ({
  recordStockMovement: vi.fn(async () => ({
    ok: true,
    previous: { stockQty: 10, reservedStock: 0 },
    next: { stockQty: 9, reservedStock: 0 },
    ledgerId: "led1",
  })),
}));

import { recordStockMovement } from "../apps/dashboard/src/lib/stock";
import {
  orderStockAfterChange,
  resolveOrderLineProduct,
  SLUG_REDIRECTS,
} from "../apps/dashboard/src/hooks/order-stock";
import { ProductSlugRedirects } from "../apps/dashboard/src/collections/ProductSlugRedirects";

type Where = Record<string, { equals?: unknown }> & { and?: Record<string, { equals?: unknown }>[] };
type FindArgs = { collection: string; where?: Where; limit?: number };

function fakePayload(opts: {
  products?: { id: string; slug?: string; sku?: string }[];
  redirects?: { oldSlug: string; product: string }[];
  ledger?: { product: string; movementType: string }[];
  redirectCollection?: boolean;
}) {
  const created: { collection: string; data: Record<string, unknown> }[] = [];
  const products = opts.products ?? [];
  const payload = {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    collections: opts.redirectCollection === false ? {} : { "product-slug-redirects": {} },
    create: vi.fn(async (args: { collection: string; data: Record<string, unknown> }) => {
      created.push(args);
      return { id: "log1" };
    }),
    find: vi.fn(async (args: FindArgs) => {
      if (args.collection === "products") {
        const w = args.where ?? {};
        const docs = products.filter((p) =>
          w.slug ? p.slug === w.slug.equals : w.sku ? p.sku === w.sku.equals : false,
        );
        return { docs: docs.slice(0, args.limit ?? 10), totalDocs: docs.length };
      }
      if (args.collection === "product-slug-redirects") {
        const want = args.where?.oldSlug?.equals;
        const docs = (opts.redirects ?? []).filter((r) => r.oldSlug === want);
        return { docs, totalDocs: docs.length };
      }
      if (args.collection === "stock-ledger") {
        const type = (args.where?.and ?? []).find((c) => c.movementType)?.movementType?.equals;
        const docs = (opts.ledger ?? []).filter((r) => r.movementType === type);
        return { docs, totalDocs: docs.length };
      }
      return { docs: [], totalDocs: 0 };
    }),
  };
  return { payload, created };
}

const resolve = (payload: unknown, line: unknown, placedAt?: string) =>
  (resolveOrderLineProduct as unknown as (p: unknown, l: unknown, d?: string) => Promise<unknown>)(
    payload,
    line,
    placedAt,
  );

describe("resolveOrderLineProduct", () => {
  it("uses the slug while it still names a product", async () => {
    const { payload } = fakePayload({ products: [{ id: "p1", slug: "ag-agcl", sku: "RE-01" }] });
    expect(await resolve(payload, { slug: "ag-agcl", sku: "RE-01" })).toEqual({
      ok: true,
      productId: "p1",
      via: "slug",
    });
  });

  it("follows the redirect a rename left behind — the bug, in one assertion", async () => {
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl-electrode", sku: "RE-01" }],
      redirects: [{ oldSlug: "ag-agcl-electrde", product: "p1" }],
    });
    expect(await resolve(payload, { slug: "ag-agcl-electrde", sku: "RE-01" })).toEqual({
      ok: true,
      productId: "p1",
      via: "redirect",
    });
  });

  it("falls back to the SKU snapshot when the rename predates any redirect table", async () => {
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl-electrode", sku: "RE-01" }],
      redirectCollection: false,
    });
    expect(await resolve(payload, { slug: "ag-agcl-electrde", sku: "RE-01" })).toEqual({
      ok: true,
      productId: "p1",
      via: "sku",
    });
  });

  it("refuses a REUSED slug rather than decrementing the wrong product", async () => {
    // p2 took the slug p1 gave up, and p2 was created AFTER the order — which
    // is what proves it cannot be the product that was bought.
    const { payload } = fakePayload({
      products: [
        { id: "p2", slug: "ag-agcl", sku: "RE-99", createdAt: "2026-06-01T00:00:00.000Z" },
        { id: "p1", slug: "ag-agcl-v2", sku: "RE-01", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
      redirectCollection: false,
    });
    expect(
      await resolve(payload, { slug: "ag-agcl", sku: "RE-01" }, "2026-05-01T00:00:00.000Z"),
    ).toEqual({ ok: true, productId: "p1", via: "sku" });
  });

  it("does NOT treat an edited SKU as a reused slug — the common case", async () => {
    /*
     * The regression the previous rule would have caused, and the reason the
     * discriminator changed. A staff member fixes a typo in p1's SKU. p1's slug
     * never moved. Every pending line still carries the OLD sku.
     *
     * Under a SKU-comparison rule this is a "conflict" and stock is never
     * decremented on an order the customer has already paid for. Under the
     * date rule p1 predates the order, so it is simply the right product.
     */
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl", sku: "RE-01-CORRECTED", createdAt: "2026-01-01T00:00:00.000Z" }],
      redirectCollection: false,
    });
    expect(
      await resolve(payload, { slug: "ag-agcl", sku: "RE-01" }, "2026-05-01T00:00:00.000Z"),
    ).toEqual({ ok: true, productId: "p1", via: "slug" });
  });

  it("trusts the slug when the order date is unknown", async () => {
    // Without a date there is nothing to compare, and refusing would be worse
    // than the behaviour before renames were considered at all.
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl", sku: "RE-XX", createdAt: "2026-06-01T00:00:00.000Z" }],
      redirectCollection: false,
    });
    expect(await resolve(payload, { slug: "ag-agcl", sku: "RE-01" })).toMatchObject({
      ok: true,
      productId: "p1",
    });
  });

  it("reports a conflict when the slug was reused and nothing else identifies the line", async () => {
    // p2 postdates the order, so the slug hit is rejected; no redirect row and
    // no matching SKU means there is nothing left to resolve to. Refusing is
    // correct here — decrementing p2 would take stock from the wrong product.
    const { payload } = fakePayload({
      products: [{ id: "p2", slug: "ag-agcl", sku: "RE-99", createdAt: "2026-06-01T00:00:00.000Z" }],
      redirectCollection: false,
    });
    expect(
      await resolve(payload, { slug: "ag-agcl", sku: "RE-01" }, "2026-05-01T00:00:00.000Z"),
    ).toEqual({ ok: false, reason: "conflict" });
  });

  it("treats a missing SKU on either side as agreement, not contradiction", async () => {
    const { payload } = fakePayload({ products: [{ id: "p1", slug: "beaker" }] });
    expect(await resolve(payload, { slug: "beaker", sku: "BK-1" })).toMatchObject({ productId: "p1" });
    const b = fakePayload({ products: [{ id: "p1", slug: "beaker", sku: "BK-1" }] });
    expect(await resolve(b.payload, { slug: "beaker" })).toMatchObject({ productId: "p1" });
  });

  it("will not guess when a SKU names more than one product", async () => {
    const { payload } = fakePayload({
      products: [
        { id: "p1", slug: "a", sku: "DUP" },
        { id: "p2", slug: "b", sku: "DUP" },
      ],
    });
    expect(await resolve(payload, { slug: "gone", sku: "DUP" })).toEqual({
      ok: false,
      reason: "ambiguous-sku",
    });
  });

  it("says so when the line carries no identifier at all", async () => {
    const { payload } = fakePayload({});
    expect(await resolve(payload, { slug: "", sku: null })).toEqual({
      ok: false,
      reason: "no-identifier",
    });
  });

  it("never touches the redirect table when that collection is not registered", async () => {
    const { payload } = fakePayload({ products: [], redirectCollection: false });
    await resolve(payload, { slug: "gone" });
    const collections = payload.find.mock.calls.map((c) => (c[0] as FindArgs).collection);
    expect(collections).not.toContain("product-slug-redirects");
  });
});

const run = (payload: unknown, doc: unknown, previousDoc: unknown, operation = "update") =>
  (orderStockAfterChange as unknown as (a: unknown) => Promise<unknown>)({
    req: { payload, user: null },
    doc,
    previousDoc,
    operation,
    collection: {},
    context: {},
  });

const paidOrder = (items: unknown[]) => ({
  id: "o1",
  orderNumber: "MM-20260904-AB12",
  status: "paid",
  items,
});

describe("orderStockAfterChange", () => {
  it("decrements the right product after the slug was renamed mid-flight", async () => {
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl-electrode", sku: "RE-01" }],
      redirects: [{ oldSlug: "ag-agcl-electrde", product: "p1" }],
    });
    await run(payload, paidOrder([{ slug: "ag-agcl-electrde", sku: "RE-01", qty: 2 }]), {
      status: "pending",
    });
    expect(recordStockMovement).toHaveBeenCalledTimes(1);
    expect(vi.mocked(recordStockMovement).mock.calls[0][1]).toMatchObject({
      productId: "p1",
      movementType: "stock-out",
      quantity: 2,
      relatedOrder: "o1",
    });
  });

  it("stays idempotent — a webhook retry must not double-decrement", async () => {
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl", sku: "RE-01" }],
      ledger: [{ product: "p1", movementType: "stock-out" }],
    });
    await run(payload, paidOrder([{ slug: "ag-agcl", sku: "RE-01", qty: 1 }]), { status: "pending" });
    expect(recordStockMovement).not.toHaveBeenCalled();
  });

  it("reports an unresolvable line durably instead of continuing in silence", async () => {
    const { payload, created } = fakePayload({ products: [], redirectCollection: false });
    await run(payload, paidOrder([{ slug: "gone", sku: "MISSING", productName: "Beaker", qty: 3 }]), {
      status: "pending",
    });
    expect(recordStockMovement).not.toHaveBeenCalled();
    expect(created).toHaveLength(1);
    expect(created[0].collection).toBe("integration-logs");
    expect(created[0].data).toMatchObject({ integration: "order-stock", status: "error" });
    expect(String(created[0].data.error)).toContain("Beaker");
  });

  it("never throws — a throw inside the paid webhook strands the payment", async () => {
    const { payload } = fakePayload({ products: [] });
    payload.create = vi.fn(async () => {
      throw new Error("log write failed");
    });
    await expect(
      run(payload, paidOrder([{ slug: "gone", qty: 1 }]), { status: "pending" }),
    ).resolves.toBeDefined();
  });

  it("moves the lines it CAN resolve even when a sibling line cannot", async () => {
    const { payload, created } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl", sku: "RE-01" }],
      redirectCollection: false,
    });
    await run(
      payload,
      paidOrder([
        { slug: "ag-agcl", sku: "RE-01", productName: "Electrode", qty: 1 },
        { slug: "gone", sku: "MISSING", productName: "Beaker", qty: 4 },
      ]),
      { status: "pending" },
    );
    expect(recordStockMovement).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(String(created[0].data.summary)).toContain("1 line");
  });

  it("does not return stock that was never taken out", async () => {
    // paid -> cancelled, but the stock-out never happened (unresolved line).
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl", sku: "RE-01" }],
      ledger: [],
    });
    await run(
      payload,
      { id: "o1", orderNumber: "MM-1", status: "cancelled", items: [{ slug: "ag-agcl", qty: 1 }] },
      { status: "paid" },
    );
    expect(recordStockMovement).not.toHaveBeenCalled();
  });

  it("does return stock that WAS taken out", async () => {
    const { payload } = fakePayload({
      products: [{ id: "p1", slug: "ag-agcl", sku: "RE-01" }],
      ledger: [{ product: "p1", movementType: "stock-out" }],
    });
    await run(
      payload,
      { id: "o1", orderNumber: "MM-1", status: "cancelled", items: [{ slug: "ag-agcl", qty: 1 }] },
      { status: "paid" },
    );
    expect(vi.mocked(recordStockMovement).mock.calls[0][1]).toMatchObject({
      productId: "p1",
      movementType: "returned",
    });
  });
});

/**
 * The two halves are joined by three string literals and nothing else.
 *
 * hooks/order-stock.ts names the redirect collection and its fields as plain
 * strings; ProductSlugRedirects.ts declares them. They match today. If either
 * side is renamed, the registry gate `payload.collections?.[collection]` simply
 * goes false, the redirect lookup silently never fires, and every renamed slug
 * on a paid order falls through to the SKU path or fails — with no error
 * anywhere. A fake-payload test cannot catch that, because the fake hardcodes
 * the same strings.
 *
 * So these assert against the REAL collection config.
 */
describe("the resolver and the redirect collection agree on names", () => {
  it("names the collection that actually exists", () => {
    expect(SLUG_REDIRECTS.collection).toBe(ProductSlugRedirects.slug);
  });

  it("names fields that actually exist on it", () => {
    const names = ProductSlugRedirects.fields.map((f) => (f as { name?: string }).name);
    expect(names).toEqual(
      expect.arrayContaining([SLUG_REDIRECTS.oldSlugField, SLUG_REDIRECTS.productField]),
    );
  });

  it("the redirect rows stay system-written — staff cannot forge one", () => {
    // A row here redirects a public URL and steers stock on a paid order, so it
    // must never be hand-creatable.
    const access = ProductSlugRedirects.access as Record<string, () => unknown>;
    expect(access.create()).toBe(false);
    expect(access.update()).toBe(false);
  });
});
