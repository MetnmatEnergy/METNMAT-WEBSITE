import type { MetadataRoute } from "next";
import { site, mainNav } from "@/frontend/lib/site";
import { getAllProducts, getAllCategories } from "@/frontend/lib/cms";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = Array.from(new Set(["/quote", "/search", ...mainNav.map((n) => n.href)]));

  // Live catalog pages from the CMS so search engines & AI crawlers discover them.
  const [products, categories] = await Promise.all([
    getAllProducts().catch(() => []),
    getAllCategories().catch(() => []),
  ]);

  const entries: MetadataRoute.Sitemap = [
    ...staticRoutes.map((path) => ({
      url: `${site.url}${path === "/" ? "" : path}`,
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : 0.7,
    })),
    ...categories.map((c) => ({
      url: `${site.url}/shop/c/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...products.map((p) => ({
      url: `${site.url}/shop/p/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  return entries;
}
