import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Payload } from "payload";
import { ensureCategory } from "../apps/dashboard/src/seed";
import { hasAttachedImage, decideCategorySeed } from "../apps/dashboard/src/lib/seed-ownership";
import {
  canManageAssets,
  canManageCatalog,
  canUploadMedia,
} from "../apps/dashboard/src/access";
import { Media } from "../apps/dashboard/src/collections/Media";

/**
 * Boot must never overwrite staff-managed data, and anyone who can author a
 * product must be able to give it a photograph.
 *
 * These are three separate production defects with one shape: a rule that was
 * correct when written, applied somewhere it destroys work.
 *
 *  1. `ensureCategory` rewrote name/blurb/order/parent on every boot, and a PM2
 *     memory restart is a boot. A rename or a re-ordering came back hours later
 *     with no deploy in between — data loss, not policy.
 *  2. `ensureCategoryImages` skipped only when the attached banner WAS the file
 *     shipped in this repo, so a staff upload — by construction not that file —
 *     was replaced. Ten of eleven departments.
 *  3. `Media.create` was gated on canManageAssets while `Products.create` was
 *     gated on canManageCatalog. Sales, Operations Manager and the Catalog area
 *     could create a product and had no way to add its image.
 *
 * The first two are driven against the REAL seed function rather than asserted
 * from source, because the claim is about what a second boot does — and only
 * running it twice can show that.
 */

// ── a Payload stand-in that records every write ────────────────────────────
type Row = Record<string, unknown> & { id: string };

function fakePayload(seedRows: Row[] = []) {
  const rows = seedRows.map((r) => ({ ...r }));
  const writes: Array<{ op: string; id?: string; data: unknown }> = [];
  let next = rows.length + 1;
  const payload = {
    find: async ({ where }: { where: { slug: { equals: string } } }) => ({
      docs: rows.filter((r) => r.slug === where.slug.equals),
    }),
    update: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      writes.push({ op: "update", id, data });
      const row = rows.find((r) => r.id === id);
      if (row) Object.assign(row, data);
      return row;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = { id: `new-${next++}`, ...data } as Row;
      writes.push({ op: "create", data });
      rows.push(row);
      return row;
    },
    logger: { info() {}, warn() {}, error() {} },
  } as unknown as Payload;
  return { payload, rows, writes };
}

const DEPARTMENT = {
  slug: "electrodes",
  name: "Electrodes",
  blurb: "Reference and working electrodes.",
  order: 3,
};

describe("first boot creates a seeded category that does not exist", () => {
  it("creates it, with the values the repository ships", async () => {
    const { payload, rows, writes } = fakePayload();
    await ensureCategory(payload, DEPARTMENT, {});

    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("create");
    expect(rows[0]).toMatchObject({
      slug: "electrodes",
      name: "Electrodes",
      blurb: "Reference and working electrodes.",
      order: 3,
    });
  });

  it("records the new id so a sub-category seeded later can resolve its parent", async () => {
    const { payload } = fakePayload();
    const ids: Record<string, string> = {};
    await ensureCategory(payload, DEPARTMENT, ids);
    expect(ids["electrodes"]).toBeTruthy();
  });
});

describe("a second boot does not touch a category staff have edited", () => {
  /** The department as it looks after someone has worked on it in the admin. */
  const edited = (): Row => ({
    id: "cat-1",
    slug: "electrodes",
    name: "Electrodes & Cells", // renamed
    blurb: "Everything three-electrode.", // rewritten
    order: 9, // moved down the menu
    parent: "parent-xyz", // re-parented
    hidden: true, // deliberately hidden
    image: { filename: "staff-upload.webp" }, // their own banner
  });

  it("issues NO write at all", async () => {
    const { payload, writes } = fakePayload([edited()]);
    await ensureCategory(payload, DEPARTMENT, {});
    expect(writes).toEqual([]);
  });

  it("leaves the row byte-identical", async () => {
    const before = edited();
    const { payload, rows } = fakePayload([before]);
    await ensureCategory(payload, DEPARTMENT, {});
    expect(rows[0]).toEqual(before);
  });

  // Each field called out separately: these are the seven regressions, and a
  // single deep-equal would not say which one broke.
  it.each([
    ["name", "name", "Electrodes & Cells"],
    ["blurb", "blurb", "Everything three-electrode."],
    ["order", "order", 9],
    ["parent", "parent", "parent-xyz"],
    ["hidden state", "hidden", true],
    ["banner", "image", { filename: "staff-upload.webp" }],
  ])("the edited %s survives the restart", async (_label, key, value) => {
    const { payload, rows } = fakePayload([edited()]);
    await ensureCategory(payload, DEPARTMENT, {});
    expect(rows[0][key]).toEqual(value);
  });

  it("still records the existing id for parent resolution", async () => {
    const { payload } = fakePayload([edited()]);
    const ids: Record<string, string> = {};
    await ensureCategory(payload, DEPARTMENT, ids);
    expect(ids["electrodes"]).toBe("cat-1");
  });

  it("is unchanged by running a third and fourth time", async () => {
    const before = edited();
    const { payload, rows, writes } = fakePayload([before]);
    for (let i = 0; i < 3; i++) await ensureCategory(payload, DEPARTMENT, {});
    expect(writes).toEqual([]);
    expect(rows[0]).toEqual(before);
  });
});

describe("the banner is filled in, never swapped out", () => {
  it.each([
    ["nothing attached", undefined],
    ["explicitly null", null],
    ["a dangling relationship Payload resolved to null", null],
    ["an object with no filename", {}],
    ["an empty id string", ""],
  ])("treats %s as free to fill", (_label, attached) => {
    expect(hasAttachedImage(attached as never)).toBe(false);
  });

  it.each([
    ["a staff upload", { filename: "staff-upload.webp" }],
    ["the default we shipped", { filename: "electrodes-banner.webp" }],
    ["a bare id from a depth-0 read", "media-123"],
  ])("treats %s as owned — do not replace", (_label, attached) => {
    expect(hasAttachedImage(attached as never)).toBe(true);
  });

  it("does not decide ownership by comparing filenames", () => {
    // The whole bug. A staff banner is never the file we ship, so a filename
    // comparison classifies every real upload as replaceable.
    const seed = withoutComments(readFileSync(join(CMS, "seed.ts"), "utf8"));
    expect(seed).toMatch(/if \(hasAttachedImage\(doc\.image\)\) continue;/);
    expect(seed).not.toMatch(/currentFile === filename/);
  });

  it("the same banner survives a deploy, a restart and a PM2 reload alike", () => {
    // All three are the same event to this code: the process starts and seed
    // runs in onInit. One predicate covers them, so there is one thing to check.
    for (let boot = 0; boot < 5; boot++) {
      expect(hasAttachedImage({ filename: "staff-upload.webp" })).toBe(true);
    }
  });
});

describe("the ownership rule is stated once", () => {
  it("an existing category is left alone", () => {
    expect(decideCategorySeed({ id: "cat-1" })).toBe("leave-alone");
  });

  it("a missing one is created", () => {
    expect(decideCategorySeed(undefined)).toBe("create");
    expect(decideCategorySeed(null)).toBe("create");
  });
});

// ── Blocker 3: who may add a product's photograph ──────────────────────────
const CMS = join(__dirname, "..", "apps", "dashboard", "src");
const withoutComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** Access helpers take the Payload request; only `user` matters to them. */
const as = (user: unknown) => ({ req: { user } }) as never;
const withRole = (...roles: string[]) => as({ collection: "users", roles });
const withArea = (...areas: string[]) =>
  as({ collection: "users", roles: [], customRoles: [{ isActive: true, areas }] });

describe("anyone who can author a product can add its image", () => {
  const authors: Array<[string, unknown]> = [
    ["super-admin", withRole("super-admin")],
    ["admin", withRole("admin")],
    ["marketing", withRole("marketing")],
    ["sales", withRole("sales")],
    ["operations-manager", withRole("operations-manager")],
    ["a designed Catalog-area role", withArea("catalog")],
  ];

  it.each(authors)("%s can create a product", (_l, u) => {
    expect(canManageCatalog(u as never)).toBe(true);
  });

  it.each(authors)("%s can therefore upload media too", (_l, u) => {
    // Before the fix, sales / operations-manager / catalog-area returned false
    // here while returning true above — create the product, cannot photograph it.
    expect(canUploadMedia(u as never)).toBe(true);
  });

  it("the three that were blocked are exactly the ones canManageAssets still refuses", () => {
    // Names the gap rather than asserting the union abstractly: if someone later
    // widens canManageAssets, this stops being a meaningful test and says so.
    for (const u of [withRole("sales"), withRole("operations-manager"), withArea("catalog")]) {
      expect(canManageAssets(u)).toBe(false);
      expect(canUploadMedia(u)).toBe(true);
    }
  });
});

describe("upload rights are not a grant of library management", () => {
  it("Media widens create AND update, but never delete", () => {
    /*
     * CORRECTED, deliberately. This asserted "create only", which was the stated
     * decision when create was widened and turned out to be incomplete:
     * Media.category is required, has no default, and decides whether the
     * resolution floor and the subject-aware crop run at all. Someone who picked
     * the wrong option could neither fix it (update refused) nor remove it
     * (delete refused), so the only move was to upload again and leave a second
     * orphan they also could not remove.
     *
     * DELETE stays narrow, and that is the half worth protecting: mediaBeforeDelete
     * already refuses anything a product or page still displays, so widening
     * delete would grant nothing except power over other people's orphans.
     */
    const media = withoutComments(readFileSync(join(CMS, "collections/Media.ts"), "utf8"));
    expect(media).toMatch(/create: canUploadMedia/);
    expect(media).toMatch(/update: canUploadMedia/);
    expect(media).toMatch(/delete: canManageAssets/);
  });

  it("a catalog author cannot alter or destroy an existing asset", () => {
    expect(canManageAssets(withArea("catalog"))).toBe(false);
  });
});

describe("it grants nothing to anyone who had nothing", () => {
  const outsiders: Array<[string, unknown]> = [
    ["a signed-out visitor", as(null)],
    ["a storefront customer", as({ collection: "customers", id: "cust-1" })],
    ["a support-only role", withArea("support")],
    ["an accounts-only role", withArea("accounts")],
    ["a settings-only role", withArea("settings")],
    ["a staff member with no roles at all", withRole()],
    ["an INACTIVE catalog role", as({ collection: "users", roles: [], customRoles: [{ isActive: false, areas: ["catalog"] }] })],
  ];

  it.each(outsiders)("%s cannot create media", (_l, u) => {
    expect(canUploadMedia(u as never)).toBe(false);
  });

  it.each(outsiders)("%s cannot create products either — the two stay in step", (_l, u) => {
    expect(canManageCatalog(u as never)).toBe(false);
  });

  it("is enforced server-side, not by hiding the button", () => {
    // Media.access is what a direct REST call hits; the admin UI derives its
    // upload control from the same permission. There is no UI-only path here.
    const media = withoutComments(readFileSync(join(CMS, "collections/Media.ts"), "utf8"));
    expect(media).toMatch(/access: \{[\s\S]{0,200}create: canUploadMedia/);
  });
});

describe("inventory and support roles are unchanged by this", () => {
  it("an Operations-area role still cannot author the catalog", () => {
    // canManageInventory is the operations area; catalog authorship is separate
    // and stays that way. Widening media must not have widened this.
    expect(canManageCatalog(withArea("operations"))).toBe(false);
    expect(canUploadMedia(withArea("operations"))).toBe(false);
  });

  it("the fixed `inventory` role is likewise not a catalog author", () => {
    expect(canManageCatalog(withRole("inventory"))).toBe(false);
    expect(canUploadMedia(withRole("inventory"))).toBe(false);
  });
});

describe("all three seed image fillers share the rule, because all three had the bug", () => {
  // The category banner was the reported one. Grepping the fix's own anchor
  // turned up two more sites with the same comparison and the same comment
  // ("Same rule as the category banners") — project covers and blog covers.
  // Fixing one and leaving two clones would have shipped a partial fix.
  const seed = withoutComments(readFileSync(join(CMS, "seed.ts"), "utf8"));

  it("no filename comparison decides ownership anywhere in the seed", () => {
    expect(seed).not.toMatch(/currentFile/);
  });

  it("guards the category banner, the project cover and the blog cover", () => {
    const guards = seed.match(/if \(hasAttachedImage\([^)]*\)\) continue;/g) ?? [];
    expect(guards).toHaveLength(3);
    expect(seed).toMatch(/hasAttachedImage\(doc\.image\)/);
    expect(seed.match(/hasAttachedImage\(doc\.coverImage\)/g) ?? []).toHaveLength(2);
  });

  it("imports the shared predicate rather than re-implementing it", () => {
    expect(seed).toMatch(/import \{ hasAttachedImage, decideCategorySeed \} from "\.\/lib\/seed-ownership"/);
  });
});

/**
 * The unfinished edge of widening Media.create.
 *
 * Earlier today `create` was widened to canUploadMedia so a catalog role could
 * add a product photo. `update` was deliberately left at canManageAssets, on the
 * reasoning that adding an asset is not managing the library. That reasoning is
 * right about OTHER people's assets and wrong about the uploader's own mistake.
 *
 * Media.category is `required: true` with NO default, chosen from eight options,
 * and it is load-bearing rather than filing: `product` is what enforces the
 * resolution floor and generates the subject-aware gallery crop. Pick the wrong
 * one and the photo uploads unprocessed. The employee then cannot correct it —
 * update is refused — and cannot delete it either, so their only move is to
 * upload the file again, creating a second row they also cannot remove.
 *
 * Deletion stays with canManageAssets deliberately: mediaBeforeDelete already
 * refuses anything a product or page still displays, so the only thing widening
 * delete would add is the power to remove someone else's unreferenced asset.
 */
describe("a catalog role can correct the image it just uploaded", () => {
  const withArea = (...areas: string[]) =>
    ({ req: { user: { collection: "users", roles: [], customRoles: [{ isActive: true, areas }] } } }) as never;
  const withRole = (...roles: string[]) =>
    ({ req: { user: { collection: "users", roles } } }) as never;

  const catalogOnly = withArea("catalog");

  it("can author products — the premise", () => {
    expect(canManageCatalog(catalogOnly)).toBe(true);
  });

  it("can upload the image", () => {
    expect(canUploadMedia(catalogOnly)).toBe(true);
  });

  it("can ALSO fix its category or alt text afterwards", () => {
    // The failing case. Without this the employee uploads a photo with the wrong
    // category, the resolution floor and the gallery crop are skipped, and there
    // is no route back: update refused, delete refused.
    expect(canUploadMedia(catalogOnly)).toBe(true);
    expect((Media.access as Record<string, unknown>).update).toBe(canUploadMedia);
  });

  it("still cannot DELETE library assets", () => {
    // Narrow on purpose. mediaBeforeDelete already protects anything in use, so
    // widening delete would only add power over other people's orphans.
    expect((Media.access as Record<string, unknown>).delete).toBe(canManageAssets);
    expect(canManageAssets(catalogOnly)).toBe(false);
  });

  it("grants nothing to someone who could not author a product", () => {
    for (const u of [withArea("support"), withArea("accounts"), withRole("inventory"), withRole()]) {
      expect(canManageCatalog(u)).toBe(false);
      expect(canUploadMedia(u)).toBe(false);
    }
  });

  it("asset managers keep full control", () => {
    for (const u of [withRole("super-admin"), withRole("admin"), withRole("marketing"), withArea("assets")]) {
      expect(canUploadMedia(u)).toBe(true);
      expect(canManageAssets(u)).toBe(true);
    }
  });
});
