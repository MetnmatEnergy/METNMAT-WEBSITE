import { describe, it, expect } from "vitest";
import { Products } from "../apps/dashboard/src/collections/Products";
import { Projects } from "../apps/dashboard/src/collections/Projects";
import { Categories } from "../apps/dashboard/src/collections/Categories";
import { StockLedger } from "../apps/dashboard/src/collections/StockLedger";
import { Media } from "../apps/dashboard/src/collections/Media";
import { productBeforeDelete } from "../apps/dashboard/src/hooks/product-guards";
import { mediaBeforeDelete } from "../apps/dashboard/src/hooks/media-guards";

/**
 * Admin config that decides whether staff can see what they are looking at.
 *
 * Three defects, all of them invisible in the sense that matters — nothing
 * errored, so nobody could tell:
 *
 *  - Products save as DRAFT by default and the list showed no status column, so
 *    an unpublished product was indistinguishable from the 131 live ones. This
 *    is the "I added it and it never appeared" report.
 *  - The list search covered `useAsTitle` alone, so a staff member holding a SKU
 *    — the code on the PO, the invoice and the shelf label — got an empty list
 *    for a product that plainly exists.
 *  - Stock Movements offered a working Create button that moved no stock and
 *    wrote a row nobody could then edit or delete.
 *
 * These assert the real collection configs, because `defaultColumns` is a plain
 * array that any later edit can quietly reorder.
 */

const admin = (c: { admin?: unknown }) => (c.admin ?? {}) as Record<string, unknown>;

describe("the Products list shows publish state first", () => {
  const cols = admin(Products).defaultColumns as string[];

  it("has a status column at all", () => {
    expect(cols).toContain("_status");
  });

  it("puts it immediately after the title, where the eye lands", () => {
    // Buried mid-row it is technically present and practically unread.
    expect(cols[0]).toBe("name");
    expect(cols[1]).toBe("_status");
  });

  it("keeps the columns staff already navigate by", () => {
    expect(cols).toEqual(expect.arrayContaining(["category", "sku", "price", "inStock"]));
  });

  it("says in the list description that a save is not a publish", () => {
    expect(String(admin(Products).description)).toMatch(/DRAFT/);
    expect(String(admin(Products).description)).toMatch(/Publish/);
  });

  it("drafts are actually on — the column would be decoration otherwise", () => {
    expect(Products.versions).toEqual(expect.objectContaining({ drafts: true }));
  });
});

describe("every draft-enabled catalog collection shows the same column", () => {
  // Projects had the same gap. Posts already had it, which is where the
  // convention came from.
  it.each([
    ["products", Products],
    ["projects", Projects],
  ])("%s", (_slug, config) => {
    expect(config.versions).toEqual(expect.objectContaining({ drafts: true }));
    expect(admin(config).defaultColumns as string[]).toContain("_status");
  });
});

describe("a product can be found by the code printed on its invoice", () => {
  const fields = admin(Products).listSearchableFields as string[];

  it("searches SKU", () => {
    expect(fields).toContain("sku");
  });

  it("still searches the name — naming fields REPLACES the useAsTitle default", () => {
    // Drop "name" here and plain name search silently stops working, which is a
    // worse bug than the one being fixed.
    expect(fields).toContain("name");
  });

  it("searches brand too", () => {
    expect(fields).toContain("brand");
  });

  it("stays identifiers-only", () => {
    // shortDesc/description would turn every marketing sentence into a hit and
    // bury the exact-code lookup this exists for.
    expect(fields).not.toContain("description");
    expect(fields).not.toContain("shortDesc");
  });

  it("is declared exactly once", () => {
    // Two independently designed patches each added this key; together they were
    // a duplicate property that fails typecheck. Merged into one.
    expect(Array.isArray(fields)).toBe(true);
    expect(fields).toHaveLength(3);
  });
});

describe("the categories list shows the number that orders the shop menu", () => {
  it("displays order", () => {
    expect(admin(Categories).defaultColumns as string[]).toContain("order");
  });

  it("sorts by it, so the list reads as the menu reads", () => {
    // Top-level, not under `admin` — Payload 3.85 declares defaultSort on the
    // collection config (collections/config/types.d.ts:490).
    expect(Categories.defaultSort).toBe("order");
  });
});

describe("the stock ledger cannot be written by hand", () => {
  const access = StockLedger.access as Record<string, () => unknown>;

  it.each(["create", "update", "delete"])("%s is refused for everyone", (op) => {
    expect(access[op]()).toBe(false);
  });

  it("but staff can still read the trail", () => {
    // read is isStaff, which reads req.user — the nav shows a collection based on
    // read alone, so closing create must not hide the audit trail.
    const asUser = (u: unknown) => (access.read as unknown as (a: unknown) => unknown)({ req: { user: u } });
    expect(asUser({ collection: "users", roles: ["inventory"] })).toBe(true);
    expect(asUser(null)).toBe(false);
  });

  it("the list says where stock IS adjusted, now that Create is gone", () => {
    // Removing the button without a signpost leaves a clerk on a page with no
    // way forward.
    expect(String(admin(StockLedger).description)).toMatch(/Stock panel on the product/);
  });
});

describe("the delete guards are actually wired to the collections", () => {
  // A guard that exists and is not registered protects nothing, and every unit
  // test of the hook itself still passes. That is the failure mode these two
  // assertions exist for — they are pinned against the REAL configs, not source
  // text, so a rename cannot slip past them either.
  it("Products refuses a delete through productBeforeDelete", () => {
    const hooks = (Products.hooks ?? {}) as Record<string, unknown[]>;
    expect(hooks.beforeDelete ?? []).toContain(productBeforeDelete);
  });

  it("Media refuses a delete through mediaBeforeDelete", () => {
    const hooks = (Media.hooks ?? {}) as Record<string, unknown[]>;
    expect(hooks.beforeDelete ?? []).toContain(mediaBeforeDelete);
  });
});

/**
 * Sentences staff read and act on, each previously untrue in a way that
 * produces a support ticket rather than an error.
 *
 * These assert the REAL config, not source text, because the failure mode is a
 * string drifting back to something inaccurate — which no type or lint catches.
 */
describe("the form does not promise things that are not so", () => {
  const desc = (c: { admin?: unknown }) => String((c.admin as { description?: unknown })?.description ?? "");

  it("does not claim an image is required to publish — nothing enforces one", () => {
    // `images` has no minRows; a product publishes with zero and the storefront
    // renders the branded placeholder. Promising otherwise sends staff hunting
    // for a validation error that will never appear.
    const essentials = JSON.stringify(Products.fields);
    expect(essentials).not.toMatch(/one Image is the minimum to publish/);
    expect(essentials).toMatch(/placeholder where the photo should be/);
  });

  it("warns that a blank price overrides the In-stock choice", () => {
    // catalog.ts isQuoteOnly(): `!product.price || ...` — a missing price makes
    // the product quote-only no matter what productType says.
    expect(JSON.stringify(Products.fields)).toMatch(/ONLY if the Price is above 0/);
  });

  it("says where a published product actually appears", () => {
    // /shop shows departments + FEATURED only. New products land on /shop/all
    // and their category page. This is the likeliest "I published it and it is
    // not there" report.
    expect(desc(Products)).toMatch(/All products/);
    expect(desc(Products)).toMatch(/Featured/);
  });

  it("labels SKU as SKU, not the derived 'Sku'", () => {
    // Payload derives the column header AND the empty-cell placeholder from the
    // field name, so the list read "Sku" and "<No Sku>".
    const sku = JSON.stringify(Products.fields).match(/"name":"sku"[^}]*"label":"([^"]*)"/);
    expect(sku?.[1]).toBe("SKU");
  });

  it("says the opening stock box locks after the FIRST save, not after 'creating'", () => {
    // With drafts on, "creating" ends at the first save — someone who saves a
    // draft and comes back finds the box read-only.
    expect(JSON.stringify(Products.fields)).toMatch(/on the very FIRST save/);
  });

  it("warns that a category created from a product becomes a department", () => {
    // The product field says "pick the most specific sub-category", then its "+"
    // opens this form with parent empty.
    expect(JSON.stringify(Categories.fields)).toMatch(/becomes a new department in the shop menu/);
  });
});
