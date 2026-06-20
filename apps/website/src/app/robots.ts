import type { MetadataRoute } from "next";
import { site } from "@/frontend/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Thin / transactional / private routes — keep them out of the index and
      // off the crawl budget (login, cart, checkout, account, search results…).
      disallow: [
        "/login",
        "/forgot",
        "/reset",
        "/cart",
        "/checkout",
        "/wishlist",
        "/account",
        "/search",
        "/api/",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
