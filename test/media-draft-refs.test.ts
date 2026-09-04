import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MEDIA_REFS,
  collectMediaUsages,
  mediaDeleteBlocker,
  type MediaRefLookup,
} from "../apps/dashboard/src/hooks/media-guards";

/**
 * A media file can be referenced by a change that has not been published yet.
 *
 * WHAT THE GUARD SEES, and the narrow place it stops seeing. `collectMediaUsages`
 * asks `payload.find` which documents point at the file. That reads the MAIN
 * collection, and for a collection with drafts the main collection holds the
 * PUBLISHED state only:
 *
 *   collections/operations/create.js:196     db.create runs unconditionally
 *   collections/operations/utilities/update.js:252  `if (!isSavingDraft)` guards db.updateOne
 *
 * So the two halves behave differently, and only one of them is a hole:
 *
 *   - A NEWLY created draft is written to the main collection, `_status: draft`
 *     and all. `find` does not filter by status, so the guard already sees it.
 *   - A draft REVISION of an already-published document is written ONLY to
 *     `_products_versions`. If that revision is what added the image, the main
 *     document does not mention it, the guard counts zero, and the delete is
 *     allowed. Publishing afterwards resurrects an id whose file and row are
 *     both gone — and because `deleteAssociatedFiles` runs after `beforeDelete`,
 *     the S3 object went with it.
 *
 * That is the defect, and it is narrower than "the guard cannot see drafts".
 * These tests pin both halves so the working one is not broken while fixing the
 * broken one.
 *
 * ONLY THE LATEST VERSION COUNTS. Every superseded version also names the images
 * it used, and honouring those would make a file undeletable forever once it had
 * ever been referenced. The current head is what will go live, so that is what
 * is protected.
 */

const P = (over: Partial<Record<string, unknown>> = {}) => ({
  find: vi.fn(async () => ({ totalDocs: 0, docs: [] })),
  findGlobal: vi.fn(async () => ({})),
  findVersions: vi.fn(async () => ({ totalDocs: 0, docs: [] })),
  ...over,
});

/** A lookup where only the named collection's DRAFT head references the file. */
const draftOnly = (collection: string, title: string) =>
  P({
    findVersions: vi.fn(async (args: { collection: string }) =>
      args.collection === collection
        ? { totalDocs: 1, docs: [{ parent: "p1", version: { name: title, title } }] }
        : { totalDocs: 0, docs: [] },
    ),
  });

describe("a file used only by an unpublished change is still in use", () => {
  it.each([
    ["products", "Ferrous Sulphate"],
    ["projects", "Heat Treatment Line"],
    ["posts", "CO2 Fuel Cells"],
  ])("%s: a draft-only reference blocks the delete", async (collection, title) => {
    // THE REGRESSION. Before the fix every one of these counted zero and the
    // file was deleted out from under a change already written and waiting.
    const db = draftOnly(collection, title) as unknown as MediaRefLookup;
    const { usages } = await collectMediaUsages(db, "m1");
    expect(usages.reduce((n, u) => n + u.count, 0)).toBeGreaterThan(0);
    expect(mediaDeleteBlocker({ filename: "photo.webp", usages })).toMatch(/still used by/i);
  });

  it("says the change is unpublished, so staff know where to look", async () => {
    // "used by 1 product" sends them to a published page that does not show it.
    const db = draftOnly("products", "Ferrous Sulphate") as unknown as MediaRefLookup;
    const { usages } = await collectMediaUsages(db, "m1");
    const msg = mediaDeleteBlocker({ filename: "photo.webp", usages }) ?? "";
    expect(msg).toMatch(/unpublished/i);
  });

  it("names the document, not just a count", async () => {
    const db = draftOnly("products", "Ferrous Sulphate") as unknown as MediaRefLookup;
    const { usages } = await collectMediaUsages(db, "m1");
    expect(mediaDeleteBlocker({ filename: "p.webp", usages })).toContain("Ferrous Sulphate");
  });
});

describe("what the version search asks for", () => {
  it("only the LATEST version, and only a draft one", async () => {
    // A superseded version naming the file must not pin it forever, and a
    // published head is already covered by the main-collection query.
    const db = P();
    await collectMediaUsages(db as unknown as MediaRefLookup, "m1");
    const call = (db.findVersions as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      where: { and: Array<Record<string, unknown>> };
    };
    expect(call).toBeDefined();
    const clauses = JSON.stringify(call.where);
    expect(clauses).toContain('"latest"');
    expect(clauses).toContain("version._status");
    expect(clauses).toContain("draft");
  });

  it("searches the versioned field paths, not the bare ones", async () => {
    const db = P();
    await collectMediaUsages(db as unknown as MediaRefLookup, "m1");
    const calls = (db.findVersions as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => JSON.stringify(c[0]),
    );
    const products = calls.find((c) => c.includes('"products"')) ?? "";
    expect(products).toContain("version.images.image");
    expect(products).toContain("version.ogImage");
  });

  it("only asks the three collections that actually have drafts", async () => {
    // findVersions against a collection with no versions config is an error, so
    // asking indiscriminately would break every delete.
    const db = P();
    await collectMediaUsages(db as unknown as MediaRefLookup, "m1");
    const asked = (db.findVersions as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { collection: string }).collection,
    );
    expect(asked.sort()).toEqual(["posts", "products", "projects"]);
  });

  it("the drafted flag matches the collections whose config enables drafts", () => {
    const SRC = join(__dirname, "..", "apps", "dashboard", "src", "collections");
    const FILE: Record<string, string> = {
      products: "Products.ts",
      categories: "Categories.ts",
      projects: "Projects.ts",
      posts: "Posts.ts",
      services: "Services.ts",
      team: "Team.ts",
      clients: "Clients.ts",
      "blog-authors": "BlogAuthors.ts",
    };
    for (const ref of MEDIA_REFS) {
      const src = readFileSync(join(SRC, FILE[ref.collection]), "utf8");
      const hasDrafts = /drafts:\s*\{/.test(src) || /drafts:\s*true/.test(src);
      expect(Boolean(ref.drafts), `${ref.collection} drafts flag`).toBe(hasDrafts);
    }
  });
});

describe("the half that already worked keeps working", () => {
  it("a published reference still blocks, with no version search needed", async () => {
    const db = P({
      find: vi.fn(async (args: { collection: string }) =>
        args.collection === "products"
          ? { totalDocs: 2, docs: [{ name: "A" }, { name: "B" }] }
          : { totalDocs: 0, docs: [] },
      ),
    });
    const { usages } = await collectMediaUsages(db as unknown as MediaRefLookup, "m1");
    expect(usages.find((u) => u.plural === "products")?.count).toBe(2);
  });

  it("an unreferenced file is still deletable — the workflow must not close", async () => {
    // The point of the guard is to stop orphaning, not to make the media
    // library append-only.
    const db = P();
    const { usages, settings } = await collectMediaUsages(db as unknown as MediaRefLookup, "m1");
    expect(mediaDeleteBlocker({ filename: "unused.webp", usages, settings })).toBeNull();
  });

  it("a settings reference still blocks", async () => {
    const db = P({ findGlobal: vi.fn(async () => ({ logo: "m1" })) });
    const { usages, settings } = await collectMediaUsages(db as unknown as MediaRefLookup, "m1");
    expect(settings).toContain("Branding");
    expect(mediaDeleteBlocker({ filename: "logo.png", usages, settings })).toMatch(/Branding/);
  });
});

describe("a lookup that cannot answer must not be read as 'unused'", () => {
  it("a failed version search refuses the delete rather than allowing it", async () => {
    // Deleting also removes the S3 object, which nothing undoes. Refusing is
    // recoverable; orphaning is not. The failure is loud rather than silent.
    const db = P({
      findVersions: vi.fn(async () => {
        throw new Error("versions unavailable");
      }),
    });
    await expect(
      collectMediaUsages(db as unknown as MediaRefLookup, "m1"),
    ).rejects.toThrow(/versions unavailable/);
  });
});

describe("the guard is still wired to the collection", () => {
  it("Media runs mediaBeforeDelete", () => {
    const src = readFileSync(
      join(__dirname, "..", "apps", "dashboard", "src", "collections", "Media.ts"),
      "utf8",
    );
    expect(src).toMatch(/beforeDelete: \[mediaBeforeDelete\]/);
  });

  it("the documented Lexical gap is still documented rather than silently closed", () => {
    // Media embedded in an article BODY as a Lexical upload node is still not
    // counted. That limit is recorded in the guard; if someone closes it, this
    // is where they should also remove the note.
    const src = readFileSync(
      join(__dirname, "..", "apps", "dashboard", "src", "hooks", "media-guards.ts"),
      "utf8",
    );
    expect(src).toMatch(/KNOWN GAP/);
    expect(src).toMatch(/Lexical/);
  });
});

describe("the Payload behaviour this fix depends on", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, "apps/dashboard/node_modules", p), "utf8");

  it("a draft revision of a published document skips the main collection", () => {
    // This is the whole reason the main-collection query cannot see it.
    expect(read("payload/dist/collections/operations/utilities/update.js")).toMatch(
      /if \(!isSavingDraft\) \{[\s\S]{0,400}?db\.updateOne/,
    );
  });

  it("a newly created draft DOES reach the main collection", () => {
    // Which is why the guard already caught that half, and why the fix must not
    // double-count it.
    const src = read("payload/dist/collections/operations/create.js");
    expect(src).toMatch(/doc = await payload\.db\.create\(/);
    expect(src).not.toMatch(/if \(!isSavingDraft\) \{\s*doc = await payload\.db\.create/);
  });

  it("version documents carry `latest` and `version._status` to filter on", () => {
    expect(read("payload/dist/versions/getLatestCollectionVersion.js")).toMatch(
      /latest: \{\s*equals: true\s*\}/,
    );
    expect(read("payload/dist/versions/getLatestCollectionVersion.js")).toMatch(
      /'version\._status'/,
    );
  });

  it("deleting media removes the S3 object after the guard has run", () => {
    // Compare the CALL sites, not the import — `deleteAssociatedFiles` is
    // imported at the top of the file, which says nothing about when it runs.
    const src = read("payload/dist/collections/operations/deleteByID.js");
    const hookAt = src.indexOf("collectionConfig.hooks.beforeDelete");
    const filesAt = src.indexOf("await deleteAssociatedFiles(");
    expect(hookAt, "the beforeDelete loop").toBeGreaterThan(-1);
    expect(filesAt, "the file removal").toBeGreaterThan(-1);
    expect(hookAt, "refusing must keep the S3 object").toBeLessThan(filesAt);
  });
});
