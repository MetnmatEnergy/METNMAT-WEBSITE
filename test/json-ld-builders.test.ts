import { describe, it, expect } from "vitest";
import {
  productJsonLd,
  articleJsonLd,
  organizationRef,
  publisherJsonLd,
} from "../apps/website/src/frontend/components/seo/schema";

const baseProduct = {
  slug: "widget",
  name: "Widget",
  sku: "MT-W-1",
  brand: "METNMAT",
  shortDesc: "A widget.",
  imageUrl: "https://cdn.test/w.jpg",
  price: 1000,
  inStock: true,
  specs: [{ label: "Body Material", value: "PTFE" }],
};

describe("productJsonLd", () => {
  it("suppresses the whole Offer for quote-only items", () => {
    // The page shows "Price on request"; advertising a concrete price and
    // InStock in structured data would misrepresent the listing in search.
    const out = productJsonLd({ product: baseProduct, priceInclGst: 1180, offerable: false });
    expect(out).not.toHaveProperty("offers");
  });

  it("emits a complete Offer for a buyable product", () => {
    const out = productJsonLd({ product: baseProduct, priceInclGst: 1180, offerable: true }) as Record<string, any>;
    expect(out.offers.price).toBe(1180);
    expect(out.offers.priceCurrency).toBe("INR");
    expect(out.offers.availability).toBe("https://schema.org/InStock");
    expect(out.offers.hasMerchantReturnPolicy.merchantReturnDays).toBe(7);
  });

  it("marks out-of-stock rather than claiming availability", () => {
    const out = productJsonLd({
      product: { ...baseProduct, inStock: false },
      priceInclGst: 1180,
      offerable: true,
    }) as Record<string, any>;
    expect(out.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("names the seller by canonical @id so it resolves to the company entity", () => {
    const out = productJsonLd({ product: baseProduct, priceInclGst: 1180, offerable: true }) as Record<string, any>;
    expect(out.offers.seller).toEqual(organizationRef);
    expect(out.offers.seller["@id"]).toMatch(/#organization$/);
  });

  it("omits optional fields instead of emitting empty nodes", () => {
    // The CMS mapper defaults brand/sku/shortDesc to "", and an empty Brand or
    // description node is invalid structured data.
    const out = productJsonLd({
      product: { slug: "x", name: "X", sku: "", brand: "", shortDesc: "", specs: [] },
      offerable: true,
    });
    for (const k of ["sku", "mpn", "brand", "description", "image", "additionalProperty", "offers"]) {
      expect(out).not.toHaveProperty(k);
    }
  });

  it("drops spec rows missing a label or value", () => {
    const out = productJsonLd({
      product: { ...baseProduct, specs: [{ label: "A", value: "1" }, { label: "", value: "2" }, { label: "C" }] },
      offerable: false,
    }) as Record<string, any>;
    expect(out.additionalProperty).toHaveLength(1);
  });

  it("never emits review or rating markup — this site has no real reviews", () => {
    const out = JSON.stringify(productJsonLd({ product: baseProduct, priceInclGst: 1180, offerable: true }));
    expect(out).not.toMatch(/AggregateRating|"review"|"Review"/);
  });
});

const baseArticle = {
  slug: "post",
  title: "A post",
  excerpt: "Summary.",
  date: "2026-01-01",
  authors: [] as { name: string; organisation?: string | null; orcidUrl?: string | null }[],
};

describe("articleJsonLd", () => {
  it("falls back to the company as author, carrying the canonical @id", () => {
    // Previously a bare {name} node sat beside a publisher for the SAME company
    // that did have a url — reading as two organisations, one anonymous.
    const out = articleJsonLd(baseArticle, false) as Record<string, any>;
    expect(out.author).toEqual(organizationRef);
    expect(out.author["@id"]).toBe(publisherJsonLd["@id"]);
  });

  it("uses named authors when present, with affiliation and ORCID", () => {
    const out = articleJsonLd(
      { ...baseArticle, authors: [{ name: "R Raj", organisation: "IIT KGP", orcidUrl: "https://orcid.org/x" }] },
      false
    ) as Record<string, any>;
    expect(out.author[0]["@type"]).toBe("Person");
    expect(out.author[0].affiliation.name).toBe("IIT KGP");
    expect(out.author[0].sameAs).toBe("https://orcid.org/x");
  });

  it("switches type for research-style articles", () => {
    expect((articleJsonLd(baseArticle, true) as Record<string, any>)["@type"]).toBe("TechArticle");
    expect((articleJsonLd(baseArticle, false) as Record<string, any>)["@type"]).toBe("BlogPosting");
  });

  it("carries a publisher logo — Google wants one on Article markup", () => {
    const out = articleJsonLd(baseArticle, false) as Record<string, any>;
    expect(out.publisher.logo["@type"]).toBe("ImageObject");
    expect(out.publisher.url).toBeTruthy();
  });
});
