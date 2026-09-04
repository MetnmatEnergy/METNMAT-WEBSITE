import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  categoryBeforeDelete,
  categoryDeleteBlocker,
} from "../apps/dashboard/src/hooks/category-guards";

/**
 * A department could be deleted out from under an unpublished product move.
 *
 * `categoryBeforeDelete` counted products with
 * `payload.count({ collection: "products", where: { category: { equals: id } } })`.
 * That reads the MAIN collection, and Products has drafts — so it sees the
 * PUBLISHED filing only.
 *
 * A draft REVISION is written solely to `_products_versions`
 * (`utilities/update.js` guards the main write with `if (!isSavingDraft)`), so a
 * product being MOVED INTO this category by an unpublished edit was not
 * counted. The delete went through, and publishing afterwards left
 * `Products.category` — a REQUIRED relationship — pointing at an id that no
 * longer resolves. That is the exact failure this guard was written to prevent,
 * reached one step later.
 *
 * The opposite case needs no work and is deliberately left alone: a draft
 * moving a product OUT still counts against the category, because the published
 * document is still filed there. Refusing then is conservative rather than
 * wrong — the product really is in the category until someone publishes.
 *
 * Sub-categories need no version search either: Categories has no `versions`
 * key, so its main collection IS its whole state.
 */

const fake = (over: Record<string, unknown> = {}) => ({
  count: vi.fn(async () => ({ totalDocs: 0 })),
  countVersions: vi.fn(async () => ({ totalDocs: 0 })),
  findByID: vi.fn(async () => ({ name: "Crucibles" })),
  ...over,
});

const run = (payload: Record<string, unknown>) =>
  categoryBeforeDelete({ req: { payload }, id: "c1" } as never);

describe("counting what is filed in a category", () => {
  it("a published product still blocks the delete", async () => {
    const payload = fake({
      count: vi.fn(async (a: { collection: string }) =>
        a.collection === "products" ? { totalDocs: 3 } : { totalDocs: 0 },
      ),
    });
    await expect(run(payload)).rejects.toThrow(/3 products/);
  });

  it("a product moved in by an UNPUBLISHED edit also blocks", async () => {
    // THE REGRESSION. Nothing counted this, so the category was deleted and the
    // draft was left pointing at a missing required relationship.
    const payload = fake({ countVersions: vi.fn(async () => ({ totalDocs: 1 })) });
    await expect(run(payload)).rejects.toThrow(/unpublished/i);
  });

  it("says the reference is unpublished, so staff know where to look", async () => {
    // "1 product" would send them to a shop listing that does not show it.
    const payload = fake({ countVersions: vi.fn(async () => ({ totalDocs: 2 })) });
    await expect(run(payload)).rejects.toThrow(/2 products with unpublished/i);
  });

  it("an empty category is still deletable", async () => {
    // The guard must not become "no category may ever be removed".
    await expect(run(fake())).resolves.toBeUndefined();
  });

  it("a sub-category still blocks on its own", async () => {
    const payload = fake({
      count: vi.fn(async (a: { collection: string }) =>
        a.collection === "categories" ? { totalDocs: 2 } : { totalDocs: 0 },
      ),
    });
    await expect(run(payload)).rejects.toThrow(/sub-categor/);
  });

  it("only products are searched for versions — Categories has none", async () => {
    // countVersions against a collection with no versions config is an error.
    const payload = fake();
    await run(payload).catch(() => undefined);
    const asked = (payload.countVersions as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { collection: string }).collection,
    );
    expect(asked).toEqual(["products"]);
  });

  it("the version search asks for the latest DRAFT head only", async () => {
    const payload = fake();
    await run(payload).catch(() => undefined);
    const where = JSON.stringify(
      (payload.countVersions as ReturnType<typeof vi.fn>).mock.calls[0]?.[0],
    );
    expect(where).toContain('"latest"');
    expect(where).toContain("version._status");
    expect(where).toContain("draft");
    expect(where).toContain("version.category");
  });

  it("a failed version count does not read as 'empty'", async () => {
    // Deleting a category cannot be undone by re-creating it: the products'
    // required relationship still points at the old id.
    const payload = fake({
      countVersions: vi.fn(async () => {
        throw new Error("versions unavailable");
      }),
    });
    await expect(run(payload)).rejects.toThrow(/unavailable/);
  });
});

describe("what the message says", () => {
  it("counts published and unpublished separately", () => {
    const msg = categoryDeleteBlocker({ products: 2, children: 0, draftProducts: 1, name: "Crucibles" }) ?? "";
    expect(msg).toContain("2 products");
    expect(msg).toMatch(/1 product with unpublished/);
  });

  it("still says nothing when the category is empty", () => {
    expect(categoryDeleteBlocker({ products: 0, children: 0, draftProducts: 0 })).toBeNull();
  });

  it("keeps the existing advice about what to do", () => {
    const msg = categoryDeleteBlocker({ products: 2, children: 0, draftProducts: 0 }) ?? "";
    expect(msg).toMatch(/Move those products|hide this one/);
  });

  it("an unpublished-only reference still explains the fix", () => {
    const msg = categoryDeleteBlocker({ products: 0, children: 0, draftProducts: 1 }) ?? "";
    expect(msg.length).toBeGreaterThan(40);
    expect(msg).toMatch(/publish|draft|unpublished/i);
  });
});

describe("the Payload behaviour this rests on", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

  it("Categories has no versions, so its main collection is its whole state", () => {
    const src = read("apps/dashboard/src/collections/Categories.ts");
    expect(src).not.toMatch(/\n {2}versions:/);
  });

  it("Products does have drafts, which is why its main collection is not", () => {
    expect(read("apps/dashboard/src/collections/Products.ts")).toMatch(/drafts:/);
  });

  it("category is a REQUIRED relationship, which is what makes a dangling id fatal", () => {
    const src = read("apps/dashboard/src/collections/Products.ts");
    const at = src.indexOf('name: "category"');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 300)).toMatch(/required: true/);
  });
});
