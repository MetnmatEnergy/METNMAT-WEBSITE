import { describe, it, expect } from "vitest";
import { planUpdate } from "../apps/dashboard/src/lib/stock";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The filters that make a stock movement safe under concurrency.
 *
 * Two people adjusting the same product at once must not lose one another's
 * write. Rather than read-modify-write, each movement is issued as a single
 * atomic `findOneAndUpdate` whose FILTER carries the business rule — a stock-out
 * only matches a document that still has enough stock. If the filter does not
 * match, nothing is written and no ledger row is created.
 *
 * These tests pin that the guard is actually present on the movements that need
 * one, because a guard silently reduced to `{}` would still pass every
 * arithmetic test in stock-math while allowing exactly the oversell this exists
 * to prevent.
 */

const plan = (t: Parameters<typeof planUpdate>[0], q: number) => {
  const p = planUpdate(t, q);
  if (!p) throw new Error(`no plan for ${t}`);
  return p;
};

describe("increases need no guard", () => {
  it("stock-in and returned simply add", () => {
    for (const t of ["stock-in", "returned"] as const) {
      const p = plan(t, 5);
      expect(p.guard, `${t} needs no precondition`).toEqual({});
      expect(p.update).toEqual({ $inc: { stockQty: 5 } });
    }
  });
});

describe("decreases are guarded against going negative", () => {
  it("stock-out and damaged carry a precondition and decrement", () => {
    for (const t of ["stock-out", "damaged"] as const) {
      const p = plan(t, 4);
      expect(p.update).toEqual({ $inc: { stockQty: -4 } });
      expect(Object.keys(p.guard), `${t} must be guarded`).not.toEqual([]);
      expect(JSON.stringify(p.guard)).toContain("$expr");
    }
  });

  it("the guard subtracts the quantity and compares against reserved stock", () => {
    // The rule being encoded: what is left after this movement must still cover
    // everything already promised to orders.
    const g = JSON.stringify(plan("stock-out", 7).guard);
    expect(g).toContain("$subtract");
    expect(g).toContain("stockQty");
    expect(g).toContain("reservedStock");
    expect(g).toContain("$gte");
    expect(g).toContain("7");
  });

  it("treats a missing field as zero, for products created before inventory existed", () => {
    const g = JSON.stringify(plan("stock-out", 1).guard);
    expect(g).toContain("$ifNull");
  });
});

describe("reservations are guarded in both directions", () => {
  it("reserving cannot exceed what is on hand", () => {
    const p = plan("reserved", 3);
    expect(p.update).toEqual({ $inc: { reservedStock: 3 } });
    const g = JSON.stringify(p.guard);
    expect(g).toContain("$lte");
    expect(g).toContain("$add");
    expect(g).toContain("stockQty");
  });

  it("releasing cannot go below zero", () => {
    const p = plan("released", 2);
    expect(p.update).toEqual({ $inc: { reservedStock: -2 } });
    const g = JSON.stringify(p.guard);
    expect(g).toContain("$gte");
    expect(g).toContain("reservedStock");
  });
});

describe("the movement never touches the wrong counter", () => {
  it("on-hand movements leave reservedStock alone, and vice versa", () => {
    for (const t of ["stock-in", "stock-out", "damaged", "returned"] as const) {
      expect(JSON.stringify(plan(t, 1).update)).not.toContain("reservedStock");
    }
    for (const t of ["reserved", "released"] as const) {
      expect(JSON.stringify(plan(t, 1).update)).not.toContain("stockQty");
    }
  });

  it("every directional movement uses $inc, never an absolute $set", () => {
    // $inc is what makes concurrent movements additive rather than
    // last-write-wins, and it treats a missing field as zero.
    for (const t of ["stock-in", "stock-out", "reserved", "released", "damaged", "returned"] as const) {
      const u = plan(t, 1).update;
      expect(Object.keys(u), `${t}`).toEqual(["$inc"]);
    }
  });
});

describe("unknown movements produce no plan", () => {
  it("returns null rather than an unguarded write", () => {
    expect(planUpdate("adjustment" as never, 1)).toBeNull();
    expect(planUpdate("nonsense" as never, 1)).toBeNull();
  });
});

describe("the product form cannot move stock", () => {
  /**
   * Structural checks on the wiring, because the arithmetic above is only
   * protective if the collection actually routes through it. Each of these has
   * a matching way to fail: delete the hook, delete the readOnly, or point the
   * opening-balance hook at the wrong service function.
   */
  const read = (p: string) => readFileSync(join(__dirname, "..", "apps", "dashboard", "src", p), "utf8");
  const products = read("collections/Products.ts");
  const guard = read("hooks/stock-guard.ts");

  it("Products runs the guard on every save", () => {
    expect(products).toMatch(/beforeChange:\s*\[stockFieldsBeforeChange\]/);
  });

  it("Products records an opening balance on create", () => {
    expect(products).toMatch(/afterChange:\s*\[recordOpeningStock,/);
  });

  it("neither stock field can be typed into on an EXISTING product", () => {
    // This used to assert `admin.readOnly: true` on both fields, and that is
    // what made the opening balance unenterable: `readOnly` is not
    // operation-aware, so locking the form on update locked it on create too.
    // The test below in this same file — "the guard exempts create, so an
    // opening balance can still be entered" — asserted the opposite intent, and
    // both passed. Two green tests disagreeing about the same behaviour is the
    // shape of this bug.
    //
    // Field access IS operation-scoped, so it states the real rule. Comments are
    // stripped first: the fix's own comment quotes the old `readOnly: true`, and
    // a source scan must not be satisfied — or misled — by prose.
    const src = products.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
    expect(src).toMatch(/name: "stockQty",[\s\S]{0,400}?access: \{ update: \(\) => false \}/);
    expect(src).toMatch(
      /name: "reservedStock",[\s\S]{0,400}?access: \{ create: \(\) => false, update: \(\) => false \}/
    );
  });

  it("the guard exempts create, so an opening balance can still be entered", () => {
    expect(guard).toMatch(/operation !== "update"/);
  });

  it("the opening balance RECORDS rather than re-applies", () => {
    // recordStockMovement would $inc a quantity the create has already written,
    // leaving the product holding double what was entered.
    expect(guard).toMatch(/recordOpeningBalance/);
    expect(guard).not.toMatch(/recordStockMovement/);
  });

  it("a discarded write is logged, not swallowed", () => {
    expect(guard).toMatch(/logger\?\.warn|logger\.warn/);
  });
});

/**
 * The opening balance must be typeable, and nothing else about stock must be.
 *
 * WHAT WAS BROKEN. Closing the direct-write bypass put `admin.readOnly: true` on
 * `stockQty` unconditionally. `readOnly` is not operation-aware, so it locked the
 * field on CREATE as well — and the field's own description said "Editable on a
 * new product as the opening balance". The description was right about the
 * intent and the code did not implement it: a new product could never be given a
 * starting count, so `recordOpeningStock` (the create hook whose entire job is
 * writing that first ledger row) could not fire from the admin at all. Every
 * product began at zero, and its ledger began at the first adjustment — exactly
 * the reconciliation gap the ledger exists to close.
 *
 * THE FIX. Field access IS operation-scoped, so `access: { update: () => false }`
 * says what `readOnly` cannot. The last block asserts that behaviour against the
 * installed packages rather than against a description of them.
 */
const CMS_SRC = join(__dirname, "..", "apps", "dashboard", "src");
/** Comments are stripped so a phrase in a comment can never satisfy — or trip — an assertion. */
const withoutComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("stock fields are editable exactly when they should be", () => {
  const products = withoutComments(readFileSync(join(CMS_SRC, "collections/Products.ts"), "utf8"));
  /**
   * The source text of one field definition, sliced by string position rather
   * than matched by regex — the field bodies contain braces and quotes, and a
   * regex that survives both is harder to read than the thing it asserts.
   */
  const field = (name: string) => {
    const start = products.indexOf(`name: "${name}",`);
    expect(start, `${name} field not found`).toBeGreaterThan(-1);
    const end = products.indexOf("\n            },", start);
    expect(end, `${name} field has no recognisable end`).toBeGreaterThan(start);
    return products.slice(start, end);
  };

  it("stockQty is NOT unconditionally read-only — that is what broke the opening balance", () => {
    expect(field("stockQty")).not.toMatch(/readOnly: true/);
  });

  it("stockQty is locked on update, so a save can never move stock", () => {
    expect(field("stockQty")).toMatch(/access: \{ update: \(\) => false \}/);
  });

  it("stockQty stays editable on create — no create:false slipped in with it", () => {
    expect(field("stockQty")).not.toMatch(/create: \(\) => false/);
  });

  it("reservedStock is locked on BOTH operations — it has no opening value", () => {
    // A number typed here would describe a reservation no order ever made.
    const f = field("reservedStock");
    expect(f).toMatch(/create: \(\) => false/);
    expect(f).toMatch(/update: \(\) => false/);
  });

  it("the description no longer promises something the field cannot do", () => {
    // The old copy said "Editable on a new product" beside readOnly: true.
    const f = field("stockQty");
    expect(f).toMatch(/opening balance/);
    expect(f).toMatch(/Adjust stock/);
  });

  it("the server-side pin is still there — field access is not the boundary", () => {
    // overrideAccess: true skips field access entirely, and the seed and the
    // importer both use it. hooks/stock-guard.ts is what actually holds.
    expect(products).toMatch(/beforeChange: \[stockFieldsBeforeChange\]/);
    expect(products).toMatch(/afterChange: \[recordOpeningStock/);
  });
});

describe("the Payload behaviour the create/update split relies on", () => {
  const ROOT_DIR = join(__dirname, "..");
  const payloadUtil = readFileSync(
    join(ROOT_DIR, "apps/dashboard/node_modules/payload/dist/utilities/getFieldPermissions.js"),
    "utf8",
  );
  const renderFields = readFileSync(
    join(ROOT_DIR, "apps/dashboard/node_modules/@payloadcms/ui/dist/forms/RenderFields/index.js"),
    "utf8",
  );

  it("field permissions are resolved per OPERATION, not once per field", () => {
    // If this stopped being operation-scoped, `update: () => false` would lock
    // the field on create again and the opening balance would silently vanish.
    expect(payloadUtil).toMatch(/operation in permissions\[field\.name\] && permissions\[field\.name\]\[operation\]/);
  });

  it("the admin renders a field read-only when that operation is not permitted", () => {
    expect(renderFields).toMatch(/if \("name" in field && !hasOperationPermission\) \{\s*isReadOnly = true;/);
  });
});
