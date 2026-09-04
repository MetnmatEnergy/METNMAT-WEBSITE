import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MEDIA_REFS,
  MEDIA_SETTINGS,
  mediaDeleteBlocker,
  mediaIdsInSettings,
} from "../apps/dashboard/src/hooks/media-guards";
import { Media } from "../apps/dashboard/src/collections/Media";

/**
 * A media file may not be deleted out from under the pages that display it.
 *
 * WHAT WAS BROKEN. Media had no beforeDelete guard while Categories has one. A
 * staff member tidying the library could remove a file that ten live product
 * pages load, and nothing warned them, nothing recorded which pages were hit,
 * and the storefront simply started rendering blank frames. The file is gone
 * from S3 at that point, so it is not recoverable by undoing anything.
 *
 * The auditor proposed covering products and categories. Media is referenced by
 * EIGHT collections and TWO globals — including the logo and the favicon, which
 * are exactly the files most likely to look like strays in the library and the
 * most damaging to remove. The extra coverage is a data table, not extra logic,
 * so the narrow version was not worth shipping.
 */

const CMS = join(__dirname, "..", "apps", "dashboard", "src");
const read = (p: string) => readFileSync(join(CMS, p), "utf8");
const withoutComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("the reference table names real fields", () => {
  // A path that does not exist yields a query that matches nothing, so the guard
  // would pass every delete and look like it worked. That failure is silent,
  // which is why it is asserted rather than trusted.
  const fieldExists = (file: string, path: string) => {
    const leaf = path.split(".").pop()!;
    const src = read(`collections/${file}`);
    const at = src.indexOf(`name: "${leaf}"`);
    if (at < 0) return false;
    return src.slice(at, at + 400).includes('relationTo: "media"');
  };

  const FILES: Record<string, string> = {
    products: "Products.ts",
    categories: "Categories.ts",
    projects: "Projects.ts",
    posts: "Posts.ts",
    services: "Services.ts",
    team: "Team.ts",
    clients: "Clients.ts",
    "blog-authors": "BlogAuthors.ts",
  };

  it("covers eight collections", () => {
    expect(MEDIA_REFS).toHaveLength(8);
    expect(MEDIA_REFS.map((r) => r.collection).sort()).toEqual(Object.keys(FILES).sort());
  });

  it.each(MEDIA_REFS.flatMap((r) => r.paths.map((p) => [r.collection, p] as const)))(
    "%s.%s is a real media upload field",
    (collection, path) => {
      expect(fieldExists(FILES[collection], path)).toBe(true);
    },
  );

  it("covers the two globals that hold media, including the logo and favicon", () => {
    expect(MEDIA_SETTINGS.map((s) => s.slug).sort()).toEqual(["branding", "seo"]);
    const branding = MEDIA_SETTINGS.find((s) => s.slug === "branding")!;
    expect(branding.paths).toContain("logo");
    expect(branding.paths).toContain("favicon");
  });
});

describe("reading media ids out of a settings document", () => {
  it("finds a plain upload field", () => {
    expect(mediaIdsInSettings({ logo: "m1", favicon: "m2" }, ["logo", "favicon"])).toEqual(["m1", "m2"]);
  });

  it("finds one inside an array row", () => {
    const doc = { heroBanners: [{ image: "m3" }, { image: "m4" }] };
    expect(mediaIdsInSettings(doc, ["heroBanners.image"])).toEqual(["m3", "m4"]);
  });

  it("tolerates a populated object as well as a bare id", () => {
    // depth 0 returns ids; a future caller passing depth > 0 must not silently
    // find nothing and wave the delete through.
    expect(mediaIdsInSettings({ logo: { id: "m5", filename: "x.webp" } }, ["logo"])).toEqual(["m5"]);
  });

  it("returns nothing for an empty or malformed document", () => {
    expect(mediaIdsInSettings(null, ["logo"])).toEqual([]);
    expect(mediaIdsInSettings({}, ["logo"])).toEqual([]);
    expect(mediaIdsInSettings({ heroBanners: "not-an-array" }, ["heroBanners.image"])).toEqual([]);
  });

  it("ignores rows whose image slot is empty", () => {
    expect(mediaIdsInSettings({ heroBanners: [{ image: null }, {}] }, ["heroBanners.image"])).toEqual([]);
  });
});

describe("the refusal tells staff where to go", () => {
  it("allows the delete when nothing points at the file", () => {
    expect(mediaDeleteBlocker({ filename: "stray.webp", usages: [], settings: [] })).toBeNull();
  });

  it("names the count and the documents", () => {
    const msg = mediaDeleteBlocker({
      filename: "electrode.webp",
      usages: [{ count: 2, singular: "product", plural: "products", examples: ["Ag/AgCl", "Pt Mesh"] }],
    })!;
    expect(msg).toContain("electrode.webp");
    expect(msg).toContain("2 products");
    expect(msg).toContain("Ag/AgCl");
    expect(msg).toContain("Pt Mesh");
  });

  it("uses the singular for one", () => {
    const msg = mediaDeleteBlocker({
      filename: "x.webp",
      usages: [{ count: 1, singular: "product", plural: "products", examples: ["Ag/AgCl"] }],
    })!;
    expect(msg).toContain("1 product ");
    expect(msg).not.toContain("1 products");
  });

  it("says 'e.g.' only when it is showing fewer than it counted", () => {
    const all = mediaDeleteBlocker({
      usages: [{ count: 2, singular: "product", plural: "products", examples: ["A", "B"] }],
    })!;
    expect(all).not.toContain("e.g.");
    const some = mediaDeleteBlocker({
      usages: [{ count: 9, singular: "product", plural: "products", examples: ["A", "B", "C"] }],
    })!;
    expect(some).toContain("e.g.");
  });

  it("blocks on a global even with no collection using it — the logo case", () => {
    const msg = mediaDeleteBlocker({ filename: "logo.webp", usages: [], settings: ["Branding"] })!;
    expect(msg).toContain("the Branding settings");
  });

  it("joins several reasons readably", () => {
    const msg = mediaDeleteBlocker({
      filename: "shared.webp",
      usages: [
        { count: 3, singular: "product", plural: "products" },
        { count: 1, singular: "category", plural: "categories" },
      ],
      settings: ["SEO"],
    })!;
    expect(msg).toMatch(/3 products, 1 category and the SEO settings/);
  });

  it("says what to do, not merely that it refused", () => {
    const msg = mediaDeleteBlocker({ usages: [{ count: 1, singular: "product", plural: "products" }] })!;
    expect(msg).toMatch(/Change or clear the image there first/);
  });
});

describe("it is wired, and it can be seen", () => {
  const media = withoutComments(read("collections/Media.ts"));

  it("Media runs the guard before deleting", () => {
    expect(media).toMatch(/beforeDelete: \[[^\]]*mediaBeforeDelete/);
  });

  it("the refusal is thrown as a staff error, so it reaches the screen", () => {
    // A bare Error here would be replaced with "Something went wrong." and the
    // list of affected products — the entire value of the guard — would be lost.
    const guard = withoutComments(read("hooks/media-guards.ts"));
    expect(guard).toMatch(/throw staffError\(blocker\)/);
    expect(guard).not.toMatch(/throw new Error\(/);
  });

  it("delete still requires asset-manager rights — the guard is not the permission", () => {
    expect((Media.access as Record<string, unknown>).delete).toBeTypeOf("function");
    expect(media).toMatch(/delete: canManageAssets/);
  });
});
