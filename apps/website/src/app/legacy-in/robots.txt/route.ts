import { isLegacyHost, renderLegacyRobots } from "../../../../legacy-domain.mjs";

/**
 * https://www.metnmat.in/robots.txt once metnmat.in points at this host. It
 * allows everything — a crawler that may not fetch an old URL never sees its
 * redirect — and names the old-URL sitemap beside it. A 404 on any other host;
 * see sitemap.xml/route.ts.
 */
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isLegacyHost(request.headers.get("host"))) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderLegacyRobots(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
