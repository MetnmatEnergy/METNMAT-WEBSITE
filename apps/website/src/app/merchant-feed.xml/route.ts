import { getAllCategories, getAllProducts } from "@/frontend/lib/cms";
import { renderMerchantFeed } from "@/frontend/lib/merchant-feed";
import { site } from "@/frontend/lib/site";

/**
 * Google Merchant Center product feed — see frontend/lib/merchant-feed.ts.
 *
 * Regenerated hourly, like the sitemaps, so a cold CMS at build time cannot pin
 * an empty catalogue; Merchant Center fetches it once a day.
 */
export const revalidate = 3600;

export async function GET() {
  const [products, categories] = await Promise.all([getAllProducts(), getAllCategories()]);
  // An empty feed would tell Google to drop every listing. If the CMS returned
  // nothing, answer 503 so Merchant Center keeps the last good fetch.
  if (!products.length) return new Response("catalogue unavailable", { status: 503 });
  return new Response(renderMerchantFeed(products, categories, site.url), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
