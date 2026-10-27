import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * An empty department is left out of the sitemap (getIndexableCategories), but
 * its page answered `index, follow`. On 2026-10-27 /shop/c/battery-components
 * and /shop/c/raw-materials were live, linked from the filter rail, and asking
 * to be indexed while showing "No products in this category yet." The page and
 * the sitemap must agree: no products → noindex (still follow).
 *
 * "Empty" is decided by getProductsByCategory, the same branch walk as the page
 * body, so a parent whose stock is all filed under its sub-departments is NOT
 * empty. The page itself is .tsx, which this suite cannot import, so its use of
 * that result is checked on the source, as the other page tests do.
 */

const realFetch = globalThis.fetch;

const CATEGORIES = [
  { slug: "furnaces", name: "Furnaces" },
  { slug: "muffle", name: "Muffle Furnaces", parent: { slug: "furnaces" } },
  { slug: "battery-components", name: "Battery Components" },
];

const PRODUCTS = [{ slug: "mf-1200", name: "Muffle Furnace 1200", category: { slug: "muffle" } }];

beforeEach(() => {
  vi.resetModules();
  globalThis.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes("/api/categories")) {
      const m = /where\[slug\]\[equals\]=([^&]+)/.exec(u);
      const docs = m ? CATEGORIES.filter((c) => c.slug === decodeURIComponent(m[1]!)) : CATEGORIES;
      return new Response(JSON.stringify({ docs }), { status: 200 });
    }
    if (u.includes("/api/products")) return new Response(JSON.stringify({ docs: PRODUCTS }), { status: 200 });
    return new Response(JSON.stringify({ docs: [] }), { status: 200 });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const count = async (slug: string) => {
  const { getProductsByCategory } = await import("../apps/website/src/frontend/lib/cms");
  return (await getProductsByCategory(slug)).length;
};

describe("what counts as an empty department", () => {
  it("one with no products of its own and no sub-departments is empty", async () => {
    expect(await count("battery-components")).toBe(0);
  });

  it("a parent whose products are all in a sub-department is not", async () => {
    expect(await count("furnaces")).toBe(1);
  });

  it("a department with products of its own is not", async () => {
    expect(await count("muffle")).toBe(1);
  });
});

describe("the category page's robots", () => {
  const src = readFileSync(join(__dirname, "..", "apps/website/src/app/shop/c/[category]/page.tsx"), "utf8");
  const meta = src.slice(src.indexOf("export async function generateMetadata"), src.indexOf("export default"));

  it("decides emptiness in generateMetadata with the page's own walk", () => {
    expect(meta).toMatch(/const empty = \(await getProductsByCategory\(category\)\)\.length === 0;/);
  });

  it("noindexes (and still follows) a filtered view or an empty department", () => {
    expect(meta).toMatch(/\.\.\.\(filtered \|\| empty \? \{ robots: \{ index: false, follow: true \} \} : \{\}\)/);
  });
});
