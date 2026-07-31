import { SECTIONS, buildSection, renderUrlset, type Section } from "@/frontend/lib/sitemap";

/**
 * Child sitemaps: /sitemaps/pages.xml, /sitemaps/products.xml, etc.
 *
 * The route param arrives WITH the ".xml" suffix (Next matches the literal path
 * segment), so it is stripped before lookup. Unknown sections 404 rather than
 * returning an empty urlset — an empty sitemap looks like "this section has no
 * pages", which is a very different signal from "that sitemap doesn't exist".
 */
// Deliberately NOT prerendered via generateStaticParams. The CMS can be cold or
// slow during a Cloud Build, and baking that snapshot is what previously
// dropped the entire product list from the sitemap. Rendering on first request
// hits a warm CMS; ISR then serves it from cache for the hour.
export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const name = section.replace(/\.xml$/, "") as Section;

  if (!SECTIONS.includes(name)) {
    return new Response("Not found", { status: 404 });
  }

  const urls = await buildSection(name);

  // Every CMS-backed section is known to have content. If a fetch fails the
  // builders degrade to [], and serving that as a cacheable 200 would tell
  // Google the section is empty — and keep saying so for an hour. A 503 with
  // no-store makes the crawler retry instead, and never overwrites the good
  // copy it already has. "pages" is a static list, so it can never be empty.
  if (name !== "pages" && urls.length === 0) {
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "600" },
    });
  }

  return new Response(renderUrlset(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
