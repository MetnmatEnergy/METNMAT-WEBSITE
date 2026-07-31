import { describe, it, expect } from "vitest";
import { renderUrlset, renderIndex, SECTIONS } from "../apps/website/src/frontend/lib/sitemap";

describe("sitemap rendering", () => {
  it("declares the image namespace only when an entry actually has images", () => {
    const plain = renderUrlset([{ loc: "https://x.test/a" }]);
    expect(plain).not.toContain("sitemap-image");

    const withImg = renderUrlset([{ loc: "https://x.test/a", images: ["https://x.test/1.jpg"] }]);
    expect(withImg).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(withImg).toContain("<image:loc>https://x.test/1.jpg</image:loc>");
  });

  it("escapes XML metacharacters — an unescaped & makes the whole file unparseable", () => {
    const xml = renderUrlset([{ loc: "https://x.test/a?b=1&c=2" }]);
    expect(xml).toContain("a?b=1&amp;c=2");
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;)/);
  });

  it("emits lastmod as a W3C datetime", () => {
    const xml = renderUrlset([{ loc: "https://x.test/a", lastmod: "2026-07-31" }]);
    expect(xml).toMatch(/<lastmod>2026-07-31T00:00:00\.000Z<\/lastmod>/);
  });

  it("omits optional fields entirely rather than emitting empty tags", () => {
    const xml = renderUrlset([{ loc: "https://x.test/a" }]);
    expect(xml).not.toContain("<lastmod>");
    expect(xml).not.toContain("<changefreq>");
    expect(xml).not.toContain("<priority>");
  });

  it("builds an index pointing at every section, each an absolute URL", () => {
    const xml = renderIndex(SECTIONS, "2026-07-31T00:00:00.000Z");
    expect(xml).toContain("<sitemapindex");
    for (const s of SECTIONS) expect(xml).toContain(`/sitemaps/${s}.xml`);
    // A sitemap index must not reference relative paths.
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].every((m) => m[1].startsWith("https://"))).toBe(true);
  });

  it("has a stable section list — child URLs are submitted to Search Console and must not churn", () => {
    expect([...SECTIONS]).toEqual(["pages", "products", "categories", "blog", "projects", "images"]);
  });
});
