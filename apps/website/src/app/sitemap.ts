import type { MetadataRoute } from "next";
import { site } from "@/frontend/lib/site";
import { mainNav } from "@/frontend/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/quote", ...mainNav.map((n) => n.href)];
  const unique = Array.from(new Set(routes));
  return unique.map((path) => ({
    url: `${site.url}${path === "/" ? "" : path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
