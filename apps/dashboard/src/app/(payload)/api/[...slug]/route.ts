import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";

export const GET = REST_GET(config);
export const POST = REST_POST(config);
export const DELETE = REST_DELETE(config);
export const PATCH = REST_PATCH(config);
export const PUT = REST_PUT(config);
export const OPTIONS = REST_OPTIONS(config);

/**
 * HEAD — every media file used to 404 to a HEAD request while returning 200 to
 * GET, so crawlers, link checkers and asset validators saw the entire media
 * library as missing, including the images listed in the website's image
 * sitemap.
 *
 * Next only auto-derives HEAD from GET when no handler claims the method.
 * Here the catch-all route does claim it, hands it to Payload's REST router,
 * and that router dispatches on the method — it has no HEAD route, so it fell
 * through to its own 404 JSON. The fix is to run the real GET and drop the
 * body.
 *
 * RFC 9110: HEAD must return the headers GET would have returned, so the
 * response headers are passed through untouched (Content-Type, Content-Length,
 * caching) and only the body is discarded. Applies to the whole REST API, not
 * just media, which is the correct semantic for all of it.
 */
export async function HEAD(
  request: Request,
  args: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const res = await GET(
    new Request(request.url, { method: "GET", headers: request.headers }),
    args,
  );
  return new Response(null, { status: res.status, headers: res.headers });
}
