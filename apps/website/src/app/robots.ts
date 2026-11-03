import type { MetadataRoute } from "next";
import { site } from "@/frontend/lib/site";

// Thin / transactional / private routes — keep them out of the index and off
// the crawl budget (login, cart, checkout, account, search results…).
const disallow = [
  "/login",
  "/signup",
  "/forgot",
  "/reset",
  "/cart",
  "/checkout",
  "/wishlist",
  "/account",
  "/search",
  // Also what keeps Google's prices in rupees: the page asks /api/geo for the
  // visitor's region, Googlebot crawls from the US, and a blocked call leaves
  // the page on INR — the currency of the Merchant Center feed and the JSON-LD.
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Merchant Center wants both crawlers named ("Unable to do quality &
      // policy checks on product pages", 2026-11-03). A named group replaces
      // the * group for that crawler, so it repeats the same rules rather than
      // Google's sample empty Disallow, which would unblock /api/geo.
      { userAgent: ["Googlebot", "Googlebot-Image"], allow: "/", disallow },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
