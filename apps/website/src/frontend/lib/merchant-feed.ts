import { inclGSTForProduct, isQuoteOnly, type Category, type Product } from "@/frontend/lib/catalog";
import { productCopy } from "@/frontend/lib/product-copy";
import { alsoKnownAs } from "@/frontend/lib/product-terms";

/**
 * Google Merchant Center product feed (RSS 2.0 + the g: namespace).
 *
 * Merchant Center account 5897661810 reads this from /merchant-feed.xml every 24
 * hours (free listings in Google Shopping). Every value must match what a buyer
 * sees on the product page, or Google disapproves the item, so the feed uses the
 * page's own rules:
 * - the same GST-inclusive price the buy box and the Offer JSON-LD show;
 * - only offerable products: not quote-only, discontinued or priced 0, which
 *   the page shows as "Price on request" with no Offer at all;
 * - no product the site keeps out of search (noIndex);
 * - a product without a photo is left out, because Google requires one.
 *
 * Shipping (free within India) and the 7-day replacement policy are account
 * settings in Merchant Center, so they are not repeated per item.
 */
export const FEED_PATH = "/merchant-feed.xml";

/**
 * Google rejected the CMS photos as "Invalid image encoding" (2026-11-03): all
 * WebP, some with alpha, served from admin.metnmat.com, which sends
 * `X-Robots-Tag: noindex` on everything. The feed therefore links a JPEG copy
 * on this site instead — flattened onto white, under a .jpg URL — made by
 * app/merchant-image/[file]/route.ts. The product pages keep the WebP.
 */
export const IMAGE_PATH = "/merchant-image";

export function merchantImageUrl(src: string, siteUrl: string): string {
  const file = src.match(/\/api\/media\/file\/([^/?#]+)$/)?.[1];
  return file ? `${siteUrl}${IMAGE_PATH}/${file}.jpg` : src;
}

/**
 * The CMS media filename (still URL-encoded) that a /merchant-image path
 * segment stands for, or null when it is not one: the route fetches whatever
 * this returns from the CMS, so it must never yield a path.
 */
export function mediaFileForImageSegment(segment: string): string | null {
  if (!segment.endsWith(".jpg")) return null;
  const file = segment.slice(0, -".jpg".length);
  let name: string;
  try {
    name = decodeURIComponent(file);
  } catch {
    return null;
  }
  if (/[/\\]/.test(name) || name.startsWith(".")) return null;
  return /\.(webp|png|jpe?g|avif|gif)$/i.test(name) ? file : null;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Google strips nothing for us: control characters make the whole file unparseable.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\s+/g, " ").trim();

const money = (inr: number) => `${inr.toFixed(2)} INR`;

export function isFeedable(p: Product): boolean {
  return !p.noIndex && !isQuoteOnly(p) && p.price > 0 && Boolean(p.imageFulls?.[0] || p.imageUrl);
}

export function feedItem(p: Product, siteUrl: string, categoryName?: string): string {
  const images = ((p.imageFulls?.length ? p.imageFulls : [p.imageUrl]).filter(Boolean) as string[]).map((src) =>
    merchantImageUrl(src, siteUrl),
  );
  const tag = (name: string, value: string | undefined) => (value ? `<${name}>${esc(clean(value))}</${name}>` : "");
  return [
    "<item>",
    // Google caps g:id at 50 characters, which 38 slugs exceed, and a changed id
    // is a new listing that starts review over. The CMS id is 24 and never changes.
    tag("g:id", p.id || p.slug),
    tag("title", p.name.slice(0, 150)),
    // Shopping matches on this text too, and buyers rarely use the catalogue name.
    tag("description", [p.shortDesc || p.name, productCopy(p)?.about ?? "", alsoKnownAs(p).length ? `Also known as: ${alsoKnownAs(p).join(", ")}.` : ""].filter(Boolean).join(" ").slice(0, 5000)),
    tag("link", `${siteUrl}/shop/p/${p.slug}`),
    tag("g:image_link", images[0]),
    ...images.slice(1, 11).map((u) => tag("g:additional_image_link", u)),
    tag("g:price", money(inclGSTForProduct(p, p.price))),
    tag("g:availability", p.inStock ? "in_stock" : "out_of_stock"),
    tag("g:condition", "new"),
    tag("g:brand", p.brand || "METNMAT"),
    tag("g:mpn", p.sku),
    // Lab equipment, mostly made by METNMAT: there are no GTINs to give.
    tag("g:identifier_exists", "no"),
    tag("g:product_type", categoryName),
    "</item>",
  ]
    .filter(Boolean)
    .join("");
}

export function renderMerchantFeed(products: Product[], categories: Category[], siteUrl: string): string {
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const items = products.filter(isFeedable).map((p) => feedItem(p, siteUrl, catName.get(p.categorySlug)));
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>` +
    `<title>METNMAT products</title><link>${esc(siteUrl)}</link>` +
    `<description>METNMAT lab equipment and materials, prices in INR including GST</description>` +
    items.join("\n") +
    `</channel></rss>\n`
  );
}
