import { site, mainNav } from "@/frontend/lib/site";
import {
  getProductSitemapEntries,
  getIndexableCategories,
  getProjects,
  getAllProducts,
} from "@/frontend/lib/cms";
import { listBlogArticlesForFeed } from "@/frontend/lib/blog";

/**
 * Sitemap generation, shared by the index (`/sitemap.xml`) and each child
 * (`/sitemaps/<section>.xml`).
 *
 * Split into children rather than one flat file so Search Console reports
 * indexing coverage per section — "42 of 68 products indexed" is actionable in
 * a way that one number over every URL on the site is not. It also keeps each
 * file well inside the 50k-URL / 50MB limits as the catalogue grows.
 */

export type SitemapUrl = {
  loc: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
  /** Image URLs for this page (image sitemap extension). */
  images?: string[];
};

export const SECTIONS = ["pages", "products", "categories", "blog", "projects", "images"] as const;
export type Section = (typeof SECTIONS)[number];

const abs = (path: string) => `${site.url}${path === "/" ? "" : path}`;

/** Only absolute http(s) URLs belong in a sitemap; CMS media can be relative. */
const absoluteImage = (url: string) =>
  /^https?:\/\//i.test(url) ? url : url.startsWith("/") ? `${site.url}${url}` : "";

async function pages(): Promise<SitemapUrl[]> {
  // "/search" is deliberately absent — robots.txt disallows it, and a sitemap
  // must not advertise URLs crawlers are told to skip.
  const paths = Array.from(
    new Set([
      "/quote",
      "/blog/submit",
      "/shop/all",
      "/support",
      "/privacy",
      "/terms",
      "/replacement-policy",
      ...mainNav.map((n) => n.href),
    ])
  );
  return paths.map((p) => ({
    loc: abs(p),
    changefreq: "weekly" as const,
    priority: p === "/" ? 1 : 0.7,
  }));
}

async function products(): Promise<SitemapUrl[]> {
  const docs = await getProductSitemapEntries().catch(() => []);
  return docs.map((p) => ({
    loc: abs(`/shop/p/${p.slug}`),
    // Prefer the last EDIT date (price/stock/spec/image changes) over creation,
    // so a re-crawl is signalled when staff update a product.
    lastmod: p.updatedAt || p.createdAt,
    changefreq: "weekly" as const,
    priority: 0.8,
  }));
}

async function categories(): Promise<SitemapUrl[]> {
  // Stricter than the storefront: hidden categories are excluded, and so are
  // empty ones. Submitting a product-free URL invites Google to judge the shop
  // by its emptiest pages.
  const docs = await getIndexableCategories().catch(() => []);
  return docs.map((c) => ({
    loc: abs(`/shop/c/${c.slug}`),
    lastmod: c.updatedAt,
    changefreq: "weekly" as const,
    priority: 0.6,
  }));
}

async function blog(): Promise<SitemapUrl[]> {
  // The feed helper already excludes drafts, scheduled, archived and noIndex.
  const docs = await listBlogArticlesForFeed(500).catch(() => []);
  return docs.map((a) => ({
    loc: abs(`/blog/${a.slug}`),
    lastmod: a.updatedAt,
    changefreq: "monthly" as const,
    priority: 0.7,
  }));
}

async function projects(): Promise<SitemapUrl[]> {
  const docs = await getProjects().catch(() => []);
  return docs.map((p) => ({
    loc: abs(`/projects/${p.slug}`),
    lastmod: p.updatedAt,
    changefreq: "monthly" as const,
    priority: 0.6,
  }));
}

/** Product pages paired with their gallery images, for Google Images. */
async function images(): Promise<SitemapUrl[]> {
  const docs = await getAllProducts().catch(() => []);
  return docs
    .map((p) => ({
      loc: abs(`/shop/p/${p.slug}`),
      images: (p.images ?? []).map(absoluteImage).filter(Boolean),
    }))
    .filter((e) => e.images.length > 0);
}

const BUILDERS: Record<Section, () => Promise<SitemapUrl[]>> = {
  pages,
  products,
  categories,
  blog,
  projects,
  images,
};

export const buildSection = (s: Section) => BUILDERS[s]();

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderUrlset(urls: SitemapUrl[]): string {
  const needsImageNs = urls.some((u) => u.images?.length);
  const ns = [
    'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    needsImageNs ? 'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = urls
    .map((u) => {
      const parts = [`<loc>${esc(u.loc)}</loc>`];
      if (u.lastmod) parts.push(`<lastmod>${esc(new Date(u.lastmod).toISOString())}</lastmod>`);
      if (u.changefreq) parts.push(`<changefreq>${u.changefreq}</changefreq>`);
      if (u.priority !== undefined) parts.push(`<priority>${u.priority}</priority>`);
      for (const img of u.images ?? []) parts.push(`<image:image><image:loc>${esc(img)}</image:loc></image:image>`);
      return `<url>${parts.join("")}</url>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset ${ns}>${body}</urlset>`;
}

export function renderIndex(sections: readonly Section[], lastmod: string): string {
  const body = sections
    .map((s) => `<sitemap><loc>${esc(`${site.url}/sitemaps/${s}.xml`)}</loc><lastmod>${lastmod}</lastmod></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}
