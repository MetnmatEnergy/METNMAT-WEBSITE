import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  slugRedirectPlan,
  productSlugRedirectAfterChange,
  categorySlugRedirectAfterChange,
} from "../apps/dashboard/src/hooks/slug-redirects";
import { Products } from "../apps/dashboard/src/collections/Products";
import { Categories } from "../apps/dashboard/src/collections/Categories";
import { ProductSlugRedirects } from "../apps/dashboard/src/collections/ProductSlugRedirects";
import { CategorySlugRedirects } from "../apps/dashboard/src/collections/CategorySlugRedirects";
import { revalidateWebsiteAfterChange } from "../apps/dashboard/src/hooks/revalidate";

/**
 * Renaming a product or a category hard-404'd every URL that had ever been
 * indexed. The blog has solved this since BlogSlugRedirects; the catalogue had
 * nothing. These pin the properties that make a redirect table useful rather
 * than a new source of bugs.
 *
 * EVERY TEST IN THIS FILE FAILS BEFORE THE CHANGE — the module under test does
 * not exist, so the import throws.
 */

// ── The decision, as a pure function ─────────────────────────────────────────

const plan = slugRedirectPlan;

describe("slugRedirectPlan", () => {
  it("mints a redirect when a PUBLISHED document is renamed", () => {
    expect(plan({ previousSlug: "pump", wasPublic: true, nextSlug: "pump-v2", isPublic: true }))
      .toEqual({ mintFor: "pump", clearShadowFor: "pump-v2" });
  });

  it("mints NOTHING when a never-published draft is renamed — that URL never existed", () => {
    expect(plan({ previousSlug: "draft-a", wasPublic: false, nextSlug: "draft-b", isPublic: false }).mintFor)
      .toBeNull();
  });

  it("clears a shadowing redirect when a NEW document is published on that slug", () => {
    // The slug-reuse case. X was renamed pump -> pump-v2, leaving {pump -> X}.
    // Y is then created and published at "pump". Payload passes previousDoc:{}
    // on create, so there is no previous slug — the blog's version of this hook
    // early-returns here and leaves the stale row pointing at X.
    expect(plan({ previousSlug: undefined, wasPublic: false, nextSlug: "pump", isPublic: true }))
      .toEqual({ mintFor: null, clearShadowFor: "pump" });
  });

  it("clears the shadow when an existing DRAFT is published without a rename", () => {
    expect(plan({ previousSlug: "pump", wasPublic: false, nextSlug: "pump", isPublic: true }).clearShadowFor)
      .toBe("pump");
  });

  it("plans NOTHING for an ordinary save — a price edit must cost no database work", () => {
    expect(plan({ previousSlug: "pump", wasPublic: true, nextSlug: "pump", isPublic: true }))
      .toEqual({ mintFor: null, clearShadowFor: null });
  });

  it("renaming BACK clears the redirect that would otherwise shadow the live URL", () => {
    // A -> B -> A. Without this clear, /shop/p/A holds a row pointing at a
    // product whose slug IS A.
    expect(plan({ previousSlug: "b", wasPublic: true, nextSlug: "a", isPublic: true }))
      .toEqual({ mintFor: "b", clearShadowFor: "a" });
  });

  it("does not clear a shadow from a save that is not public", () => {
    expect(plan({ previousSlug: "a", wasPublic: true, nextSlug: "b", isPublic: false }).clearShadowFor)
      .toBeNull();
  });
});

// ── The real hooks, against a recording payload ──────────────────────────────

function recorder(rows: { id: string; oldSlug: string }[] = []) {
  const deleted: string[] = [];
  const created: Record<string, unknown>[] = [];
  const updated: Record<string, unknown>[] = [];
  const payload = {
    logger: { error: () => {}, warn: () => {} },
    db: {
      deleteMany: async ({ where }: { where: { oldSlug: { equals: string } } }) => {
        deleted.push(where.oldSlug.equals);
      },
    },
    find: async ({ where }: { where: { oldSlug: { equals: string } } }) => ({
      docs: rows.filter((r) => r.oldSlug === where.oldSlug.equals),
    }),
    update: async (args: Record<string, unknown>) => { updated.push(args); },
    create: async (args: Record<string, unknown>) => { created.push(args); },
  };
  return { payload, deleted, created, updated };
}

const runProduct = async (previousDoc: unknown, doc: unknown, rows?: { id: string; oldSlug: string }[]) => {
  const rec = recorder(rows);
  await (productSlugRedirectAfterChange as unknown as (a: unknown) => Promise<unknown>)({
    req: { payload: rec.payload }, doc, previousDoc,
  });
  return rec;
};

const runCategory = async (previousDoc: unknown, doc: unknown, rows?: { id: string; oldSlug: string }[]) => {
  const rec = recorder(rows);
  await (categorySlugRedirectAfterChange as unknown as (a: unknown) => Promise<unknown>)({
    req: { payload: rec.payload }, doc, previousDoc,
  });
  return rec;
};

describe("productSlugRedirectAfterChange", () => {
  it("records the old slug against the product ID, never against the new slug", async () => {
    const rec = await runProduct(
      { slug: "pump", _status: "published" },
      { id: "p1", slug: "pump-v2", _status: "published" },
    );
    // Storing the ID rather than a destination slug is what makes A->B->C one
    // hop instead of a chain.
    expect(rec.created).toEqual([
      expect.objectContaining({
        collection: "product-slug-redirects",
        data: { oldSlug: "pump", product: "p1" },
        overrideAccess: true,
      }),
    ]);
  });

  it("leaves BOTH old slugs pointing at the same product after two renames", async () => {
    const first = await runProduct({ slug: "a", _status: "published" }, { id: "p1", slug: "b", _status: "published" });
    const second = await runProduct({ slug: "b", _status: "published" }, { id: "p1", slug: "c", _status: "published" });
    expect((first.created[0] as { data: { product: string } }).data.product).toBe("p1");
    expect((second.created[0] as { data: { product: string } }).data.product).toBe("p1");
  });

  it("deletes a stale redirect when a NEW product is published on that slug", async () => {
    const rec = await runProduct(
      { slug: "pump", _status: "draft" },
      { id: "p2", slug: "pump", _status: "published" },
      [{ id: "r1", oldSlug: "pump" }],
    );
    expect(rec.deleted).toEqual(["pump"]);
    expect(rec.created).toEqual([]);
  });

  it("touches nothing on a save that changes neither the slug nor the status", async () => {
    const rec = await runProduct(
      { slug: "pump", _status: "published" },
      { id: "p1", slug: "pump", _status: "published", price: 999 },
    );
    expect([rec.deleted, rec.created, rec.updated]).toEqual([[], [], []]);
  });

  it("mints nothing for a never-published product", async () => {
    const rec = await runProduct(
      { slug: "wip-a", _status: "draft" },
      { id: "p3", slug: "wip-b", _status: "draft" },
    );
    expect(rec.created).toEqual([]);
  });

  it("re-points an existing row rather than failing the unique index", async () => {
    const rec = await runProduct(
      { slug: "a", _status: "published" },
      { id: "p9", slug: "z", _status: "published" },
      [{ id: "r7", oldSlug: "a" }],
    );
    expect(rec.updated).toEqual([
      expect.objectContaining({ id: "r7", data: { product: "p9" }, overrideAccess: true }),
    ]);
  });

  it("never fails the save when redirect upkeep throws", async () => {
    const payload = {
      logger: { error: () => {}, warn: () => {} },
      db: { deleteMany: async () => { throw new Error("mongo is unhappy"); } },
      find: async () => ({ docs: [] }),
      update: async () => {}, create: async () => {},
    };
    await expect(
      (productSlugRedirectAfterChange as unknown as (a: unknown) => Promise<unknown>)({
        req: { payload },
        doc: { id: "p1", slug: "b", _status: "published" },
        previousDoc: { slug: "a", _status: "published" },
      }),
    ).resolves.toBeDefined();
  });
});

describe("categorySlugRedirectAfterChange", () => {
  it("treats 'hidden' as the off switch, not a draft status", async () => {
    const visible = await runCategory({ slug: "a" }, { id: "c1", slug: "b" });
    expect((visible.created[0] as { data: { oldSlug: string } }).data.oldSlug).toBe("a");
    const hidden = await runCategory({ slug: "a", hidden: true }, { id: "c1", slug: "b", hidden: true });
    expect(hidden.created).toEqual([]);
  });

  it("clears a shadowing redirect when a NEW department is created on that slug", async () => {
    const rec = await runCategory({}, { id: "c2", slug: "crucibles" }, [{ id: "r1", oldSlug: "crucibles" }]);
    expect(rec.deleted).toEqual(["crucibles"]);
  });

  it("touches nothing when the boot seed attaches a banner image", async () => {
    // seed.ts ensureCategoryImages updates categories on every boot.
    const rec = await runCategory({ slug: "furnaces" }, { id: "c3", slug: "furnaces", image: "m1" });
    expect([rec.deleted, rec.created, rec.updated]).toEqual([[], [], []]);
  });
});

// ── Wiring, read off the real collection configs ─────────────────────────────

describe("catalog redirect wiring", () => {
  it("runs the redirect hook BEFORE the website is told to purge", () => {
    // Hooks are awaited in array order. Purging first lets the website re-render
    // the renamed URL, find no product and no redirect, and cache a 404.
    for (const [config, hook] of [
      [Products, productSlugRedirectAfterChange],
      [Categories, categorySlugRedirectAfterChange],
    ] as const) {
      const hooks = config.hooks!.afterChange!;
      expect(hooks.indexOf(hook as never)).toBeGreaterThanOrEqual(0);
      expect(hooks.indexOf(hook as never)).toBeLessThan(hooks.indexOf(revalidateWebsiteAfterChange));
    }
  });

  it("keeps both redirect tables system-managed and unwritable from outside", () => {
    for (const c of [ProductSlugRedirects, CategorySlugRedirects]) {
      expect((c.access!.create as () => boolean)()).toBe(false);
      expect((c.access!.update as () => boolean)()).toBe(false);
      // The website resolves old URLs anonymously, same as the blog table.
      expect((c.access!.read as (a: unknown) => unknown)({ req: {} })).toBe(true);
    }
  });

  it("keeps oldSlug unique per namespace — one row can own one old URL", () => {
    // The reason products and categories do not share one table: a product and a
    // category may both legitimately be slugged "crucibles".
    for (const c of [ProductSlugRedirects, CategorySlugRedirects]) {
      const f = c.fields.find((x) => (x as { name?: string }).name === "oldSlug") as
        | { unique?: boolean; index?: boolean; required?: boolean }
        | undefined;
      expect(f).toMatchObject({ unique: true, index: true, required: true });
    }
  });
});

// ── The website side, against a stubbed CMS ──────────────────────────────────

const realFetch = globalThis.fetch;

type Row = { oldSlug: string; product?: unknown; category?: unknown };

function cms(rows: Row[], products: { slug: string }[], categories: { slug: string; hidden?: boolean }[]) {
  return vi.fn(async (url: unknown) => {
    const u = String(url);
    const slugOf = (s: string) => {
      const m = new RegExp(`where\\[${s}\\]\\[equals\\]=([^&]+)`).exec(u);
      return m ? decodeURIComponent(m[1]!) : null;
    };
    const json = (docs: unknown[]) => new Response(JSON.stringify({ docs }), { status: 200 });
    if (u.includes("-slug-redirects")) {
      const old = slugOf("oldSlug");
      return json(rows.filter((r) => r.oldSlug === old));
    }
    if (u.includes("/api/products")) {
      const s = slugOf("slug");
      return json(products.filter((p) => p.slug === s));
    }
    if (u.includes("/api/categories")) {
      const s = slugOf("slug");
      return json(categories.filter((c) => c.slug === s));
    }
    return json([]);
  });
}

async function loadCms() {
  vi.resetModules();
  return import("../apps/website/src/frontend/lib/cms");
}

afterEach(() => { globalThis.fetch = realFetch; });
beforeEach(() => { vi.resetModules(); });

describe("resolveProductSlugRedirect", () => {
  it("lands the FIRST-EVER slug on today's URL in one hop", async () => {
    // A -> B -> C leaves two rows, both pointing at the same product document.
    globalThis.fetch = cms(
      [{ oldSlug: "a", product: { slug: "c" } }, { oldSlug: "b", product: { slug: "c" } }],
      [{ slug: "c" }],
      [],
    ) as unknown as typeof fetch;
    const { resolveProductSlugRedirect } = await loadCms();
    expect(await resolveProductSlugRedirect("a")).toBe("c");
    expect(await resolveProductSlugRedirect("b")).toBe("c");
  });

  it("404s rather than 301ing into a 404 when the target is gone or unpublished", async () => {
    // An unreadable or missing relationship populates as its bare id.
    globalThis.fetch = cms([{ oldSlug: "a", product: "66f0000000000000000000aa" }], [], []) as unknown as typeof fetch;
    const { resolveProductSlugRedirect } = await loadCms();
    expect(await resolveProductSlugRedirect("a")).toBeNull();
  });

  it("404s when the target populated but is no longer publicly visible", async () => {
    globalThis.fetch = cms([{ oldSlug: "a", product: { slug: "c" } }], [], []) as unknown as typeof fetch;
    const { resolveProductSlugRedirect } = await loadCms();
    expect(await resolveProductSlugRedirect("a")).toBeNull();
  });

  it("refuses to redirect a slug onto itself", async () => {
    globalThis.fetch = cms([{ oldSlug: "a", product: { slug: "a" } }], [{ slug: "a" }], []) as unknown as typeof fetch;
    const { resolveProductSlugRedirect } = await loadCms();
    expect(await resolveProductSlugRedirect("a")).toBeNull();
  });
});

describe("resolveCategorySlugRedirect", () => {
  it("resolves a renamed department", async () => {
    globalThis.fetch = cms([{ oldSlug: "old", category: { slug: "new" } }], [], [{ slug: "new" }]) as unknown as typeof fetch;
    const { resolveCategorySlugRedirect } = await loadCms();
    expect(await resolveCategorySlugRedirect("old")).toBe("new");
  });

  it("never redirects onto a HIDDEN department, which would 301 into a 404", async () => {
    // Categories read publicly, so unlike a draft product a hidden category DOES
    // populate through the relationship. The visibility re-check is load-bearing.
    globalThis.fetch = cms(
      [{ oldSlug: "old", category: { slug: "retired" } }],
      [],
      [{ slug: "retired", hidden: true }],
    ) as unknown as typeof fetch;
    const { resolveCategorySlugRedirect } = await loadCms();
    expect(await resolveCategorySlugRedirect("old")).toBeNull();
  });
});
