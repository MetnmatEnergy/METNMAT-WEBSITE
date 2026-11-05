/**
 * The day the shop's pages last changed in code.
 *
 * Much of what a product or category page says comes from this repository
 * (product-copy.ts, category-seo.ts, topic-seo.ts), so a page can change while its
 * CMS record stays put. The sitemap then told Google that all 141 products last
 * changed on 2026-10-27, the day they were rebuilt being invisible to it, and
 * Google had no reason to come back.
 *
 * Move this date only when those pages really change, and never on every deploy:
 * Google stops trusting lastmod on a site where it is often wrong.
 */
export const SHOP_PAGES_CHANGED_ON = "2026-11-05";

/** The later of a CMS edit date and the last change in code. */
export function pageLastmod(cmsDate: string | undefined): string {
  const edited = cmsDate ? Date.parse(cmsDate) : NaN;
  return !Number.isNaN(edited) && edited > Date.parse(SHOP_PAGES_CHANGED_ON) ? (cmsDate as string) : SHOP_PAGES_CHANGED_ON;
}

/** Static routes whose text lives in code and changed with the shop's pages. */
export const changesWithShop = (path: string) =>
  path === "/" || path === "/shop" || path.startsWith("/shop/") || path.startsWith("/guides") || path.startsWith("/tools/");
