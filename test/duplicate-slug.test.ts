import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  copySlugBase,
  firstFreeCopySlug,
  slugBeforeDuplicate,
  COPY_SEARCH_LIMIT,
} from "../apps/dashboard/src/lib/duplicate-slug";

/**
 * Duplicating a catalog document twice failed.
 *
 * WHAT PAYLOAD DOES, verified in 3.85.1 rather than assumed. `duplicate` is
 * `create` with a `duplicateFromID`:
 *
 *   collections/operations/duplicate.js:4   createOperation({...args, duplicateFromID: id})
 *   collections/endpoints/duplicate.js:9    const { draft = true } = parseParams(...)
 *   duplicateDocument/index.js:34           source = await getLatestCollectionVersion(...)
 *   duplicateDocument/index.js:63           source = await beforeDuplicate({doc: source, req, ...})
 *   fields/setDefaultBeforeDuplicate.js:5   unique text fields get `${value} - Copy`
 *   fields/config/sanitize.js:168-174       ...but only when the field has no beforeDuplicate of its own
 *   beforeValidate/getFallbackValue.js:7    every field absent from `data` is cloned from that source
 *   beforeValidate/promise.js:208           the field's own beforeValidate hook receives that cloned value
 *
 * So the duplicate arrives carrying `"ferrous-sulphate - Copy"`.
 *
 * WHAT THAT MEANS HERE, and it is NOT what the audit said. Every one of the
 * eight unique-slug collections already runs the canonical `slugify` over the
 * slug during beforeValidate — seven through a field-level hook, Posts through
 * a collection-level one. `"ferrous-sulphate - Copy"` is normalised to
 * `"ferrous-sulphate-copy"` before it is ever written. The "slug with spaces in
 * a URL" problem is therefore NOT reachable, and these tests pin that so the
 * claim cannot quietly become true again.
 *
 * The reachable defect is the second duplicate. Both duplicates of the same
 * document normalise to the identical `"ferrous-sulphate-copy"`, the unique
 * index rejects the second, and `db-mongodb/handleError.js:44` turns it into
 * "Value must be unique" against the slug field. Staff cannot clear it, because
 * the duplicate action gives them nowhere to change the slug first — the second
 * duplicate is simply impossible.
 *
 * THE FIX. A field-level `beforeDuplicate` on the slug, which by
 * `sanitize.js:168-174` also replaces Payload's `" - Copy"` default rather than
 * competing with it. It reuses the canonical `slugify` from `lib/blog` — no
 * second slug system — and picks the first free `-copy`, `-copy-2`, `-copy-3`.
 */

describe("the base a copy is numbered from", () => {
  it("normalises through the canonical slugify", () => {
    expect(copySlugBase("Ferrous Sulphate")).toBe("ferrous-sulphate");
    expect(copySlugBase("ferrous-sulphate - Copy")).toBe("ferrous-sulphate");
  });

  it("strips a -copy suffix so copies do not nest", () => {
    // Duplicating a copy should give another numbered copy of the original
    // thing, not "ferrous-sulphate-copy-copy".
    expect(copySlugBase("ferrous-sulphate-copy")).toBe("ferrous-sulphate");
    expect(copySlugBase("ferrous-sulphate-copy-2")).toBe("ferrous-sulphate");
    expect(copySlugBase("ferrous-sulphate-copy-17")).toBe("ferrous-sulphate");
  });

  it("does not mistake a word ending in copy for a copy suffix", () => {
    expect(copySlugBase("photocopy")).toBe("photocopy");
    expect(copySlugBase("hard-copy-paper")).toBe("hard-copy-paper");
  });

  it("survives a slug that slugifies to nothing", () => {
    // "!!!" has no usable characters. A base of "" must not produce "-copy",
    // which is not a valid slug.
    expect(copySlugBase("!!!")).toBe("");
    expect(copySlugBase("")).toBe("");
    expect(copySlugBase(undefined)).toBe("");
    expect(copySlugBase(null)).toBe("");
  });
});

describe("choosing the first free copy slug", () => {
  it("A. the first copy is -copy", () => {
    expect(firstFreeCopySlug("ferrous-sulphate", ["ferrous-sulphate"])).toBe("ferrous-sulphate-copy");
  });

  it("B. the second copy is -copy-2", () => {
    expect(
      firstFreeCopySlug("ferrous-sulphate", ["ferrous-sulphate", "ferrous-sulphate-copy"]),
    ).toBe("ferrous-sulphate-copy-2");
  });

  it("C. the third copy is -copy-3", () => {
    expect(
      firstFreeCopySlug("ferrous-sulphate", [
        "ferrous-sulphate",
        "ferrous-sulphate-copy",
        "ferrous-sulphate-copy-2",
      ]),
    ).toBe("ferrous-sulphate-copy-3");
  });

  it("fills a gap rather than always appending", () => {
    // -copy-2 was deleted. Reusing it keeps the numbers readable instead of
    // climbing forever.
    expect(
      firstFreeCopySlug("ferrous-sulphate", [
        "ferrous-sulphate",
        "ferrous-sulphate-copy",
        "ferrous-sulphate-copy-3",
      ]),
    ).toBe("ferrous-sulphate-copy-2");
  });

  it("an empty base yields plain 'copy', never a leading dash", () => {
    expect(firstFreeCopySlug("", [])).toBe("copy");
    expect(firstFreeCopySlug("", ["copy"])).toBe("copy-2");
  });

  it("terminates even when many copies exist", () => {
    const taken = ["x", "x-copy", ...Array.from({ length: 50 }, (_, i) => `x-copy-${i + 2}`)];
    expect(firstFreeCopySlug("x", taken)).toBe("x-copy-52");
  });

  it("D. every slug it produces is lowercase, URL-safe and unused", () => {
    const VALID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const taken: string[] = ["ferrous-sulphate"];
    for (let i = 0; i < 12; i++) {
      const next = firstFreeCopySlug("ferrous-sulphate", taken);
      expect(next, "no spaces").not.toMatch(/\s/);
      expect(next, "lowercase and URL safe").toMatch(VALID);
      expect(next).toBe(next.toLowerCase());
      expect(taken, "never collides with an existing slug").not.toContain(next);
      taken.push(next);
    }
    // Deterministic and readable, not random.
    expect(taken.slice(1, 4)).toEqual([
      "ferrous-sulphate-copy",
      "ferrous-sulphate-copy-2",
      "ferrous-sulphate-copy-3",
    ]);
  });

  it("keeps the result within the 120-character slug budget", () => {
    // `slugify` caps at 120, so a long base plus "-copy-12" must not overflow
    // into a slug the rest of the system would truncate differently.
    const long = "a".repeat(118);
    const out = firstFreeCopySlug(long, [`${long}-copy`]);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

type FakeOpts = { fail?: boolean };

const fakeReq = (taken: string[] = [], opts: FakeOpts = {}) => {
  const find = vi.fn(async (args: { where?: { slug?: { like?: string } }; limit?: number }) => {
    if (opts.fail) throw new Error("catalogue unavailable");
    const like = args?.where?.slug?.like;
    const docs = taken
      .filter((s) => (typeof like === "string" ? s.includes(like) : true))
      .slice(0, args?.limit ?? 1000)
      .map((slug) => ({ slug }));
    return { docs };
  });
  const warn = vi.fn();
  return { req: { payload: { find, logger: { warn, error: vi.fn() } } }, find, warn };
};

const dup = async (value: unknown, req: unknown, collectionSlug = "products") =>
  (await slugBeforeDuplicate()({
    value,
    req,
    collection: { slug: collectionSlug },
  } as never)) as string;

describe("the hook Payload actually calls", () => {
  it("A/B/C in sequence against a growing catalogue", async () => {
    const taken = ["ferrous-sulphate"];
    for (const expected of [
      "ferrous-sulphate-copy",
      "ferrous-sulphate-copy-2",
      "ferrous-sulphate-copy-3",
    ]) {
      const { req } = fakeReq(taken);
      const got = await dup("ferrous-sulphate", req);
      expect(got).toBe(expected);
      taken.push(got);
    }
  });

  it("E. the source document is not modified", async () => {
    // beforeDuplicate is handed the source doc. Returning a value is how a new
    // slug is set; writing through the arguments would edit the original.
    const source = Object.freeze({ slug: "ferrous-sulphate", name: "Ferrous Sulphate" });
    const { req } = fakeReq(["ferrous-sulphate"]);
    const out = await slugBeforeDuplicate()({
      value: source.slug,
      req,
      collection: { slug: "products" },
      previousSiblingDoc: source,
      siblingData: source,
    } as never);
    expect(out).toBe("ferrous-sulphate-copy");
    expect(source.slug, "the original keeps its slug").toBe("ferrous-sulphate");
  });

  it("F. behaves the same for every one of the eight unique-slug collections", async () => {
    for (const c of [
      "blog-authors",
      "blog-categories",
      "blog-content-types",
      "categories",
      "posts",
      "products",
      "projects",
      "services",
    ]) {
      const { req, find } = fakeReq(["thing"]);
      const got = await dup("thing", req, c);
      expect(got, c).toBe("thing-copy");
      expect(find.mock.calls[0]?.[0], c).toMatchObject({ collection: c });
    }
  });

  it("G. an unusual existing slug still yields a valid slug", async () => {
    const VALID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const odd of ["Ferrous Sulphate - Copy", "!!!", "", "a--b", "  spaced  out  "]) {
      const { req } = fakeReq([]);
      const got = await dup(odd, req);
      expect(got, `input: ${JSON.stringify(odd)}`).toMatch(VALID);
      expect(got).not.toMatch(/\s/);
    }
  });

  it("searches once, not once per candidate", async () => {
    const { req, find } = fakeReq(["x", "x-copy", "x-copy-2", "x-copy-3"]);
    const got = await dup("x", req);
    expect(got).toBe("x-copy-4");
    expect(find, "one query decides every candidate").toHaveBeenCalledTimes(1);
  });

  it("H. two concurrent duplicates can still pick the same slug — the index is the backstop", async () => {
    // Honest about the limit rather than implying a lock exists. The search and
    // the write are not atomic, so simultaneous duplicates can agree on
    // -copy-2; MongoDB's unique index rejects the loser, which surfaces as
    // "Value must be unique" (db-mongodb/handleError.js:44) rather than as two
    // documents sharing a URL. Silent corruption is the thing being prevented.
    const taken = ["x", "x-copy"];
    const a = fakeReq(taken);
    const b = fakeReq(taken);
    const [one, two] = await Promise.all([dup("x", a.req), dup("x", b.req)]);
    expect(one).toBe("x-copy-2");
    expect(two).toBe("x-copy-2");
  });

  it("still produces a usable slug when the search fails", async () => {
    const { req, warn } = fakeReq([], { fail: true });
    const got = await dup("ferrous-sulphate", req);
    expect(got).toBe("ferrous-sulphate-copy");
    expect(warn).toHaveBeenCalled();
  });

  it("returns a slug even with no req to search with", async () => {
    const got = await dup("ferrous-sulphate", undefined);
    expect(got).toBe("ferrous-sulphate-copy");
  });
});

describe("the eight collections are wired to it", () => {
  const SRC = join(__dirname, "..", "apps", "dashboard", "src");
  const COLLECTIONS = [
    "BlogAuthors",
    "BlogCategories",
    "BlogContentTypes",
    "Categories",
    "Posts",
    "Products",
    "Projects",
    "Services",
  ];

  it.each(COLLECTIONS)("%s applies slugBeforeDuplicate to its slug field", (name) => {
    const src = readFileSync(join(SRC, "collections", `${name}.ts`), "utf8");
    expect(src).toMatch(/beforeDuplicate: \[slugBeforeDuplicate\(\)\]/);
  });

  it("no collection disables duplicate instead of fixing it", () => {
    for (const name of COLLECTIONS) {
      const src = readFileSync(join(SRC, "collections", `${name}.ts`), "utf8");
      expect(src, name).not.toMatch(/disableDuplicate:\s*true/);
    }
  });

  it("reuses the canonical slugify rather than defining a second one", () => {
    const src = readFileSync(join(SRC, "lib", "duplicate-slug.ts"), "utf8");
    expect(src).toMatch(/from "\.\/blog"/);
    expect(src, "no hand-rolled slug regex").not.toMatch(/\[\^a-z0-9\]\+/);
  });
});

describe("the Payload behaviour this fix depends on", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, "apps/dashboard/node_modules", p), "utf8");

  it("a field's own beforeDuplicate replaces Payload's ' - Copy' default", () => {
    // sanitize.js only installs the default when the field has none of its own,
    // so this fix supersedes it rather than fighting it.
    const src = read("payload/dist/fields/setDefaultBeforeDuplicate.js");
    expect(src).toMatch(/!field\.hooks\?\.beforeDuplicate/);
    expect(src).toMatch(/\$\{value\} - Copy/);
  });

  it("beforeDuplicate hooks are awaited, so the search can be async", () => {
    const src = read("payload/dist/fields/hooks/beforeDuplicate/promise.js");
    expect(src).toMatch(/hookResult = await hook\(beforeDuplicateArgs\)/);
    expect(src).toMatch(/value: siblingDoc\[field\.name\]/);
  });

  it("the hook receives req, so it can query the collection", () => {
    const src = read("payload/dist/fields/hooks/beforeDuplicate/promise.js");
    expect(src).toMatch(/const beforeDuplicateArgs = \{[\s\S]{0,600}?\breq,/);
  });

  it("the duplicated value reaches the new document through getFallbackValue", () => {
    const src = read("payload/dist/fields/hooks/beforeValidate/getFallbackValue.js");
    expect(src).toMatch(/fallbackValue = cloneDataFromOriginalDoc\(siblingDoc\[field\.name\]\)/);
  });

  it("a duplicate is created as a DRAFT where drafts exist — the framework decides this", () => {
    // The admin posts _status: draft, and the REST endpoint defaults draft=true.
    // The lifecycle is therefore already established; this fix must not change it.
    expect(read("@payloadcms/ui/dist/elements/DuplicateDocument/index.js")).toMatch(
      /hasDraftsEnabled\(collectionConfig\) \? \{\s*_status: 'draft'\s*\}/,
    );
    expect(read("payload/dist/collections/endpoints/duplicate.js")).toMatch(/draft = true/);
  });

  it("a unique collision surfaces as a field validation error, not a stack trace", () => {
    const src = read("@payloadcms/db-mongodb/dist/utilities/handleError.js");
    expect(src).toMatch(/error\.code === 11000/);
    expect(src).toMatch(/error:valueMustBeUnique/);
  });
});

describe("the slug is already normalised before it is stored", () => {
  const SRC = join(__dirname, "..", "apps", "dashboard", "src", "collections");

  it("all eight run slugify over the slug during beforeValidate", () => {
    // This is why the audit's "slug with spaces" symptom is NOT reachable, and
    // it must stay that way: without it, Payload's " - Copy" default would
    // reach the database verbatim.
    for (const name of [
      "BlogAuthors",
      "BlogCategories",
      "BlogContentTypes",
      "Categories",
      "Products",
      "Projects",
      "Services",
    ]) {
      const src = readFileSync(join(SRC, `${name}.ts`), "utf8");
      // Sliced by position rather than matched by one regex: the field bodies
      // carry long descriptions, and a gap-limited pattern fails for reasons
      // that have nothing to do with the behaviour being asserted.
      const start = src.indexOf('name: "slug"');
      expect(start, `${name} has a slug field`).toBeGreaterThan(-1);
      const field = src.slice(start, src.indexOf("beforeDuplicate", start));
      expect(field, `${name} normalises its slug in beforeValidate`).toMatch(/beforeValidate/);
      expect(field, `${name} uses the canonical slugify`).toMatch(/slugify\(/);
    }
    // Posts normalises at collection level instead.
    expect(readFileSync(join(SRC, "Posts.ts"), "utf8")).toMatch(
      /data\.slug = slugify\(data\.slug \|\| data\.title \|\| ""\)/,
    );
  });

  it("COPY_SEARCH_LIMIT is high enough that truncation is not a live concern", () => {
    expect(COPY_SEARCH_LIMIT).toBeGreaterThanOrEqual(200);
  });
});
