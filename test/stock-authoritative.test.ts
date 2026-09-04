import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stockFieldsBeforeChange } from "../apps/dashboard/src/hooks/stock-guard";

/**
 * The guard must preserve the stock the product ACTUALLY holds.
 *
 * WHAT WAS BROKEN. `preserveStockFields` is correct in itself — it pins the
 * stock fields to whatever it is told the stored value is. The defect was the
 * source it was told: the hook passed `originalDoc`, and for a collection with
 * drafts enabled Payload sets that from `getLatestCollectionVersion`, which
 * returns `latestVersion.version` — a VERSION SNAPSHOT, not the live document.
 *
 * That snapshot goes stale in a way nothing refreshes, because the two writers
 * never meet:
 *
 *   - `lib/stock.ts` moves stock through the native driver, straight at the
 *     `products` collection. It is deliberately invisible to Payload, which is
 *     what keeps these hooks from recursing into it — and it therefore mints no
 *     new version.
 *   - `saveVersion` only runs on a Payload save.
 *
 * So an adjustment made through the ledger leaves the main document changed and
 * every existing snapshot untouched. The next save that mentioned stock pinned
 * the field back to the snapshot and silently reverted the adjustment.
 *
 * The draft case is worse than stale. A draft save skips the main-collection
 * write entirely (`utilities/update.js`: `if (!isSavingDraft)`), so the snapshot
 * it stores is built from submitted data — and field access has already deleted
 * `stockQty` from that data by then (`beforeValidate/promise.js:226`, which runs
 * before this hook). The snapshot ends up with no `stockQty` key at all, and
 * `Number(undefined)` is `NaN`, which the preserver floors to 0. A later save
 * would pin real stock to ZERO.
 *
 * WHY THIS PATH IS REACHABLE AT ALL. On the admin path field access removes the
 * key before this hook runs, so there is nothing to pin and the stored value
 * survives untouched. `overrideAccess: true` skips field access — and the seed
 * and the importer both use it. Those are exactly the callers that arrive here
 * with a stock key in hand, which is why this hook, and not field access, is the
 * boundary.
 *
 * THE FIX. Read the count from the `products` collection itself — the same
 * document `lib/stock.ts` writes — so the two agree by construction. The
 * snapshot stays as the fallback: if the read fails the guard is no weaker than
 * it was, and it says so in the log rather than failing open.
 */

type Stored = { stockQty?: number; reservedStock?: number } | null;

const fakeReq = (stored: Stored, opts: { fail?: boolean } = {}) => {
  const findOne = vi.fn(async () => {
    if (opts.fail) throw new Error("products collection unreachable");
    return stored;
  });
  const collection = vi.fn(() => ({ findOne }));
  const warn = vi.fn();
  const req = {
    payload: {
      db: { connection: { collection } },
      logger: { warn, error: vi.fn() },
    },
    user: { email: "staff@metnmat.com" },
  };
  return { req, findOne, collection, warn };
};

const save = async (
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown>,
  req: unknown,
  operation: "create" | "update" = "update",
) => {
  await stockFieldsBeforeChange({ data, originalDoc, operation, req } as never);
  return data;
};

describe("stock is preserved from the live document, not a version snapshot", () => {
  it("an adjustment made through the ledger is not reverted by a later save", async () => {
    // THE REGRESSION. Opening stock 100, adjusted down to 60 through the real
    // stock path. The version snapshot still says 100, because that path writes
    // through the native driver and mints no version. A save that resubmits the
    // stale 100 must not undo the adjustment.
    const { req } = fakeReq({ stockQty: 60, reservedStock: 0 });
    const data = await save(
      { name: "Reference Electrode", stockQty: 100 },
      { id: "p1", stockQty: 100, reservedStock: 0 },
      req,
    );
    expect(data.stockQty, "the adjustment to 60 must survive the save").toBe(60);
  });

  it("a snapshot that never recorded stock cannot zero the real count", async () => {
    // The draft case. The snapshot has no stockQty key at all, and the old code
    // resolved that to 0 — pinning a product holding 60 units down to nothing.
    const { req } = fakeReq({ stockQty: 60 });
    const data = await save({ stockQty: 60 }, { id: "p1" }, req);
    expect(data.stockQty, "a missing key in the snapshot must not mean zero").toBe(60);
  });

  it("reservedStock is read from the live document too", async () => {
    const { req } = fakeReq({ stockQty: 60, reservedStock: 4 });
    const data = await save({ reservedStock: 99 }, { id: "p1", reservedStock: 0 }, req);
    expect(data.reservedStock).toBe(4);
  });

  it("the live count wins even when the attempt happens to match the snapshot", async () => {
    // The silent-undo shape: nobody typed anything, the form simply resubmitted
    // what it read before the adjustment. Attempt and snapshot agree, so nothing
    // is reported as discarded — and the write would still have reverted stock.
    const { req } = fakeReq({ stockQty: 60 });
    const data = await save({ stockQty: 100 }, { id: "p1", stockQty: 100 }, req);
    expect(data.stockQty).toBe(60);
  });

  it("a save that does not mention stock reads nothing and adds nothing", async () => {
    // Unrelated patches must not pay for a database round trip, and must not
    // gain stock keys they never had — that would rewrite the field on every
    // edit to an unrelated one.
    const { req, findOne } = fakeReq({ stockQty: 60 });
    const data = await save({ name: "Renamed" }, { id: "p1", stockQty: 60 }, req);
    expect(findOne, "no stock key means no reason to read").not.toHaveBeenCalled();
    expect("stockQty" in data).toBe(false);
    expect("reservedStock" in data).toBe(false);
  });

  it("the live document is read once, however many stock fields are mentioned", async () => {
    const { req, findOne } = fakeReq({ stockQty: 60, reservedStock: 4 });
    await save({ stockQty: 1, reservedStock: 2 }, { id: "p1" }, req);
    expect(findOne).toHaveBeenCalledTimes(1);
  });

  it("if the live document cannot be read, the snapshot is still preferred over the attempt", async () => {
    // Fails no worse than it did before, rather than failing open.
    const { req, warn } = fakeReq(null, { fail: true });
    const data = await save({ stockQty: 500 }, { id: "p1", stockQty: 100 }, req);
    expect(data.stockQty).toBe(100);
    expect(
      warn.mock.calls.some((c) => /authoritative/i.test(JSON.stringify(c))),
      "the fallback must be logged, not silent",
    ).toBe(true);
  });

  it("a product missing from the products collection falls back to the snapshot", async () => {
    const { req } = fakeReq(null);
    const data = await save({ stockQty: 500 }, { id: "p1", stockQty: 100 }, req);
    expect(data.stockQty).toBe(100);
  });

  it("a product with no id at all falls back to the snapshot", async () => {
    const { req, findOne } = fakeReq({ stockQty: 60 });
    const data = await save({ stockQty: 500 }, { stockQty: 100 }, req);
    expect(data.stockQty).toBe(100);
    expect(findOne, "there is nothing to look up").not.toHaveBeenCalled();
  });

  it("the discarded attempt is logged against the live count, not the snapshot", async () => {
    // The warning is what tells staff their edit did not take. Reporting the
    // snapshot would name a number the product does not hold.
    const { req, warn } = fakeReq({ stockQty: 60 });
    await save({ stockQty: 500 }, { id: "p1", stockQty: 100 }, req);
    const discarded = warn.mock.calls.find((c) => /discarded/i.test(JSON.stringify(c)));
    expect(discarded, "a rejected write must be logged").toBeDefined();
    expect(JSON.stringify(discarded)).toContain('"kept":60');
  });

  it("create is still exempt, so an opening balance can be entered", async () => {
    const { req, findOne } = fakeReq({ stockQty: 0 });
    const data = await save({ stockQty: 250 }, {}, req, "create");
    expect(data.stockQty, "the opening balance is the one stock write a save may make").toBe(250);
    expect(findOne).not.toHaveBeenCalled();
  });

  it("the products collection is the one that is read", async () => {
    // Reading anything else — a versions collection in particular — would
    // reintroduce exactly the staleness this fix removes.
    const { req, collection } = fakeReq({ stockQty: 60 });
    await save({ stockQty: 1 }, { id: "p1" }, req);
    expect(collection).toHaveBeenCalledWith("products");
  });
});

describe("the Payload behaviour this fix depends on", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, "apps/dashboard/node_modules", p), "utf8");

  it("originalDoc comes from the latest VERSION when drafts are enabled", () => {
    // `latestVersion.version` is a snapshot. If this ever returned the live
    // document instead, the bug would disappear on its own — and the fallback
    // in the guard would become the only path that matters.
    const src = read("payload/dist/versions/getLatestCollectionVersion.js");
    expect(src).toMatch(/return latestVersion\.version/);
  });

  it("a draft save never writes the main collection, which is why its snapshot lacks stock", () => {
    const src = read("payload/dist/collections/operations/utilities/update.js");
    expect(src).toMatch(/if \(!isSavingDraft\) \{[\s\S]{0,400}?db\.updateOne/);
  });

  it("field access deletes the value BEFORE this hook runs, so only overrideAccess reaches it", () => {
    const src = read("payload/dist/fields/hooks/beforeValidate/promise.js");
    expect(src).toMatch(/delete siblingData\[field\.name\]/);
    expect(src).toMatch(/overrideAccess \? true/);
  });
});
