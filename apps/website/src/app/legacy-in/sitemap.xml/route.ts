import { isLegacyHost, renderLegacySitemap } from "../../../../legacy-domain.mjs";
import { legacyInPaths } from "../../../../legacy-redirects.mjs";

/**
 * https://www.metnmat.in/sitemap.xml once metnmat.in points at this host: every
 * URL the old site served, each of which now 301s to metnmat.com. Submitted in
 * the metnmat.in Search Console property, it gets Google to recrawl the old
 * URLs — and so meet their redirects — now rather than over weeks. See
 * legacy-domain.mjs.
 *
 * Reached only through the host-scoped rewrite in next.config.mjs. Asked for on
 * any other host it is a 404: www.metnmat.com must never publish a sitemap of
 * another domain's URLs.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isLegacyHost(request.headers.get("host"))) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderLegacySitemap(legacyInPaths), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
