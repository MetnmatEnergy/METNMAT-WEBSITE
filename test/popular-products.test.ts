import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { footerProducts } from "../apps/website/src/frontend/lib/site";

const footer = readFileSync(new URL("../apps/website/src/frontend/components/layout/site-footer.tsx", import.meta.url), "utf8");

describe("popular products in the footer", () => {
  it("is on every page, whatever the CMS navigation holds", () => {
    expect(footer).toMatch(/footerResources, footerProducts\]/);
  });

  it("links real product pages, once each", () => {
    const hrefs = footerProducts.links.map((l) => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^\/shop\/p\/[a-z0-9-]+$/);
  });

  it("stays short enough to be a list and not a link farm", () => {
    expect(footerProducts.links.length).toBeLessThanOrEqual(8);
  });

  it("uses the words buyers search, with no name the catalogue does not claim", () => {
    const labels = footerProducts.links.map((l) => l.label).join(" ");
    expect(labels).toContain("Zinc sheet");
    expect(labels).not.toMatch(/nafion|best|cheap/i);
  });
});
