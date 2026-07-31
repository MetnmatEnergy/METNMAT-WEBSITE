import { SECTIONS, renderIndex } from "@/frontend/lib/sitemap";

/**
 * Sitemap INDEX. Children live at /sitemaps/<section>.xml.
 *
 * This replaces the previous flat `app/sitemap.ts`, which listed every URL on
 * the site in one file. Search Console reports coverage per submitted sitemap,
 * so the split is what turns "126 URLs, 118 indexed" into a per-section number
 * you can act on.
 *
 * Regenerated hourly rather than pinned at build time: the CMS can be cold
 * during a Cloud Build, which previously dropped the entire product list from
 * the sitemap. At runtime the CMS is warm, so a bad snapshot self-heals.
 */
export const revalidate = 3600;

export async function GET() {
  // Hour-bucketed so <lastmod> is stable within a revalidate window instead of
  // changing on every request (which trains crawlers to ignore it).
  const lastmod = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
  return new Response(renderIndex(SECTIONS, lastmod), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
