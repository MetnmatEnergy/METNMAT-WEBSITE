import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { changesWithShop, pageLastmod, SHOP_PAGES_CHANGED_ON } from "../apps/website/src/frontend/lib/sitemap-dates";
import { productPageTitle } from "../apps/website/src/frontend/lib/seo";
import { TOPIC_SEO, topicLinks, topicProducts } from "../apps/website/src/frontend/lib/topic-seo";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

const src = (f: string) => readFileSync(new URL(`../apps/website/src/${f}`, import.meta.url), "utf8");
const product = (name: string, categorySlug: string) =>
  ({ slug: name, name, categorySlug, price: 1000, gstRate: 18 }) as unknown as Product;

describe("sitemap dates", () => {
  it("never reports a date older than the last change in code", () => {
    expect(pageLastmod("2026-10-27T10:00:00.000Z")).toBe(SHOP_PAGES_CHANGED_ON);
    expect(pageLastmod(undefined)).toBe(SHOP_PAGES_CHANGED_ON);
    expect(pageLastmod("not a date")).toBe(SHOP_PAGES_CHANGED_ON);
  });

  it("keeps a later staff edit", () => {
    expect(pageLastmod("2027-01-02T10:00:00.000Z")).toBe("2027-01-02T10:00:00.000Z");
  });

  it("dates the routes rebuilt in code and leaves the rest undated", () => {
    for (const p of ["/", "/shop", "/shop/all", "/shop/t/pem-electrolyzers", "/guides", "/guides/x", "/tools/potential-converter"]) {
      expect(changesWithShop(p), p).toBe(true);
    }
    for (const p of ["/about", "/contact", "/privacy", "/support"]) expect(changesWithShop(p), p).toBe(false);
  });

  it("is what the sitemap uses for products and categories", () => {
    const s = src("frontend/lib/sitemap.ts");
    expect(s).toContain("pageLastmod(p.updatedAt || p.createdAt)");
    expect(s).toContain("pageLastmod(c.updatedAt)");
  });
});

describe("product titles", () => {
  it("say price when the page shows one", () => {
    expect(productPageTitle("PEM Hydrogen Electrolyzer, 60 mL/min H2 Output", true)).toEqual({
      absolute: "PEM Hydrogen Electrolyzer, 60 mL/min H2 Output: Price in India",
    });
  });

  it("stay plain with no public price, and never say price twice", () => {
    expect(productPageTitle("Peristaltic Pump KPK200", false)).toBe("Peristaltic Pump KPK200");
    expect(productPageTitle("Nickel Foam Price List", true)).toBe("Nickel Foam Price List");
  });

  it("is used by the product page", () => {
    expect(src("app/shop/p/[slug]/page.tsx")).toContain("title: productPageTitle(title,");
  });
});

describe("links into the shop", () => {
  it("keeps the header menu in the HTML while closed", () => {
    const menu = src("frontend/components/commerce/departments-menu.tsx");
    expect(menu).toContain("hidden={!open}");
    expect(menu).not.toContain("{open && (");
    expect(src("frontend/components/layout/site-header.tsx")).toContain("popular={topicLinks()}");
  });

  it("links the home page to the categories, topics and the full list", () => {
    expect(src("frontend/components/home/products-preview.tsx")).toContain("<BrowseShop />");
    const home = src("frontend/components/home/browse-shop.tsx");
    expect(home).toContain("/shop/c/${d.slug}");
    expect(home).toContain("topicLinks()");
    expect(home).toContain('href="/shop/all"');
  });

  it("reaches every product from /shop/all, and /shop/all from every page", () => {
    expect(src("app/shop/all/page.tsx")).toContain("<ProductIndex");
    expect(src("frontend/components/commerce/product-index.tsx")).toContain("/shop/p/${p.slug}");
    expect(src("frontend/lib/site.ts")).toContain('{ label: "All products", href: "/shop/all" }');
  });

  it("lists each topic page once", () => {
    const links = topicLinks();
    expect(links).toHaveLength(Object.keys(TOPIC_SEO).length);
    expect(new Set(links.map((l) => l.href)).size).toBe(links.length);
  });
});

describe("topic pages for words that are not a category's name", () => {
  it("PEM electrolyzers holds the electrolyzers and not the fuel cell or the membranes", () => {
    const all = [
      product("PEM Hydrogen Electrolyzer Cell, 60 mL/min", "water-splitting-reactors"),
      product("High Temperature PEM/AEM Electrolyzer Hardware", "water-splitting-reactors"),
      product("5 cm² Research-Scale Electrolyzer Cell – Graphite & Nickel Serpentine Flow Field", "water-splitting-reactors"),
      product("EWF Transparent Flow Electrolyzer (Zero Gap)", "water-splitting-reactors"),
      product("5 cm² PEM Fuel Cell Hardware", "fuel-cells"),
      product("Perfluorosulfonic Acid (PFSA) Proton Exchange Membrane N115 (PEM)", "pem-membranes"),
      product("EWB Water Splitting Reactor", "water-splitting-reactors"),
    ];
    expect(topicProducts(TOPIC_SEO["pem-electrolyzers"], all)).toHaveLength(4);
  });

  it("Fumasep spans its three membrane categories and leaves out other brands", () => {
    const all = [
      product("Fumasep FAA-3-20 – Anion Exchange Membrane", "aem-membranes"),
      product("Fumasep FS-9100-PK – Cation Exchange Membrane", "cem-membranes"),
      product("Fumasep FBM – Bipolar Ion Exchange Membrane", "bipolar-membranes"),
      product("Sustainion X37-50 Grade RT Anion Exchange Membrane", "aem-membranes"),
    ];
    expect(topicProducts(TOPIC_SEO["fumasep-membranes"], all)).toHaveLength(3);
  });

  it("Swagelok holds the battery cells only", () => {
    const all = [
      product("Swagelok Battery Test Fixture (PTFE)", "battery-reactors"),
      product("Swagelok-Type Two-Electrode Battery Test Cell", "battery-reactors"),
      product("Metal-Air Battery Reactor", "battery-reactors"),
    ];
    expect(topicProducts(TOPIC_SEO["swagelok-cells"], all)).toHaveLength(2);
  });
});
