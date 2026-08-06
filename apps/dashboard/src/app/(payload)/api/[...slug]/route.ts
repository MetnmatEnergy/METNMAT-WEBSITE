import config from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";
import { MEDIA_CACHE_CONTROL, shouldCacheMedia } from "../../../../lib/media-cache";

/**
 * Uploaded images were served with NO `Cache-Control` at all, so nothing —
 * browser, CDN or proxy — was permitted to store them. Every view of every
 * product photo woke a Cloud Run instance, spent CPU re-streaming bytes out of
 * a private GCS bucket, and paid egress again for a file that never changes.
 * A website static asset already returns `max-age=3600, immutable` and shows a
 * real edge `Age`; media returned neither.
 *
 * ONLY `/api/media/file/**` is cached, and the narrowness is the security
 * control, not fussiness. `media` is the one upload collection with
 * `read: publicRead` (Media.ts:15) and it answers anonymously with 200. The
 * others must never be handed to a shared cache: `documents` 403s anonymously,
 * `enquiry-uploads` is staff/internal-key only, and `blog-submission-files` is
 * commented "NEVER public — unpublished manuscripts". A `public` directive on
 * any of those would let one CDN edge serve another user's private file.
 *
 * Non-200s are excluded too — caching a 404 for a year would outlive the
 * upload that fixes it.
 */
const restGet = REST_GET(config);

export const GET = async (
  request: Request,
  args: { params: Promise<{ slug: string[] }> },
): Promise<Response> => {
  const res = await restGet(request, args);

  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return res;
  }

  const cacheable = shouldCacheMedia({
    pathname,
    status: res.status,
    hasCacheControl: res.headers.has("cache-control"),
  });
  if (!cacheable) return res;

  const headers = new Headers(res.headers);
  headers.set("Cache-Control", MEDIA_CACHE_CONTROL);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
};

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
