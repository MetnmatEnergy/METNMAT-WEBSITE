import { describe, it, expect } from "vitest";
import { renderMerchantFeed, isFeedable } from "../apps/website/src/frontend/lib/merchant-feed";
import type { Product } from "../apps/website/src/frontend/lib/catalog";

/**
 * Google disapproves a listing whose feed price, availability or photo differs
 * from the product page, so the feed must apply the page's own rules.
 */

const base = {
  id: "6ae056abe0702d8fa7ab095c",
  slug: "swagelok-cell",
  name: "Swagelok Cell <PEEK> & Co",
  brand: "METNMAT",
  categorySlug: "battery-reactors",
  sku: "MT-SW-1",
  price: 1000, // excl. GST
  gstRate: 18,
  rating: 0,
  reviewCount: 0,
  inStock: true,
  moq: 1,
  unit: "pc",
  priceTiers: [],
  shortDesc: "A reusable test cell.",
  imageFulls: ["https://admin.metnmat.com/api/media/file/a.webp", "https://admin.metnmat.com/api/media/file/b.webp"],
} as unknown as Product;

const feed = (ps: Partial<Product>[]) =>
  renderMerchantFeed(
    ps.map((p) => ({ ...base, ...p }) as Product),
    [{ slug: "battery-reactors", name: "Battery Reactors" } as never],
    "https://www.metnmat.com",
  );

describe("merchant feed", () => {
  it("lists a buyable product with the page's GST-inclusive price", () => {
    const xml = feed([{}]);
    expect(xml).toContain("<g:id>6ae056abe0702d8fa7ab095c</g:id>");
    expect(xml).toContain("<g:price>1180.00 INR</g:price>");
    expect(xml).toContain("<link>https://www.metnmat.com/shop/p/swagelok-cell</link>");
    expect(xml).toContain("<g:availability>in_stock</g:availability>");
    expect(xml).toContain("<g:image_link>https://admin.metnmat.com/api/media/file/a.webp</g:image_link>");
    expect(xml).toContain("<g:additional_image_link>https://admin.metnmat.com/api/media/file/b.webp</g:additional_image_link>");
    expect(xml).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(xml).toContain("<g:product_type>Battery Reactors</g:product_type>");
  });

  it("keys items by the CMS id, which stays within Google's 50-character limit when the slug does not", () => {
    const long = "fumion-faa-3-solut-10-anion-exchange-ionomer-dispersion-in-nmp-100-ml";
    const xml = feed([{ slug: long }]);
    expect(xml).toContain("<g:id>6ae056abe0702d8fa7ab095c</g:id>");
    expect(xml).toContain(`<link>https://www.metnmat.com/shop/p/${long}</link>`);
  });

  it("escapes XML so one product name cannot break the whole file", () => {
    expect(feed([{}])).toContain("<title>Swagelok Cell &lt;PEEK&gt; &amp; Co</title>");
  });

  it("reports out-of-stock honestly", () => {
    expect(feed([{ inStock: false }])).toContain("<g:availability>out_of_stock</g:availability>");
  });

  it("leaves out everything the page does not offer for sale", () => {
    // Price on request (0), quote-only, discontinued, hidden from search, no photo.
    expect(isFeedable({ ...base, price: 0 })).toBe(false);
    expect(isFeedable({ ...base, productType: "quote-only" })).toBe(false);
    expect(isFeedable({ ...base, productType: "discontinued" })).toBe(false);
    expect(isFeedable({ ...base, noIndex: true })).toBe(false);
    expect(isFeedable({ ...base, imageFulls: [], imageUrl: undefined })).toBe(false);
    expect(feed([{ price: 0 }, { slug: "ok" }]).match(/<item>/g)).toHaveLength(1);
  });
});
