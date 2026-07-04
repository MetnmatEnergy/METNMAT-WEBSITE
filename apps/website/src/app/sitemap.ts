import type { MetadataRoute } from "next";
import { site, mainNav } from "@/frontend/lib/site";
import { getAllProducts, getAllCategories, getProjects } from "@/frontend/lib/cms";
import { listBlogArticlesForFeed } from "@/frontend/lib/blog";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = Array.from(
    new Set(["/quote", "/search", "/blog/submit", ...mainNav.map((n) => n.href)]),
  );

  // Live catalog + article pages from the CMS so search engines & AI crawlers
  // discover them. Drafts / scheduled / archived / noIndex articles never
  // appear (the CMS only exposes public articles and the feed helper also
  // excludes noIndex).
  const [products, categories, articles, projects] = await Promise.all([
    getAllProducts().catch(() => []),
    getAllCategories().catch(() => []),
    listBlogArticlesForFeed(500).catch(() => []),
    getProjects().catch(() => []),
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
    ...articles.map((a) => ({
      url: `${site.url}/blog/${a.slug}`,
      ...(a.updatedAt ? { lastModified: a.updatedAt } : {}),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...projects.map((p) => ({
      url: `${site.url}/projects/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return entries;
}
