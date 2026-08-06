import { describe, it, expect } from "vitest";
import { shouldCacheMedia, MEDIA_CACHE_CONTROL } from "../apps/dashboard/src/lib/media-cache";

/**
 * Uploaded images were served with no Cache-Control at all, so every view of
 * every product photo woke a Cloud Run instance and paid egress again for
 * bytes that never change.
 *
 * The rule's narrowness is a SECURITY control. `media` is the only upload
 * collection with `read: publicRead`; `documents` 403s anonymously,
 * `enquiry-uploads` is internal-key only, and `blog-submission-files` holds
 * unpublished manuscripts. Marking any of those `public` would let one CDN
 * edge replay a private file to a different visitor. Most of these tests exist
 * to keep that boundary where it is.
 */
const ok = (pathname: string, over: Partial<Parameters<typeof shouldCacheMedia>[0]> = {}) =>
  shouldCacheMedia({ pathname, status: 200, hasCacheControl: false, ...over });

describe("shouldCacheMedia", () => {
  it("caches a public media file", () => {
    expect(ok("/api/media/file/hydrogen-fuel-cell.webp")).toBe(true);
  });

  it("emits a year-long immutable directive", () => {
    expect(MEDIA_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
  });

  it.each([
    ["/api/documents/file/invoice.pdf", "403s anonymously"],
    ["/api/enquiry-uploads/file/rfq.pdf", "staff / internal-key only"],
    ["/api/blog-submission-files/file/draft.docx", "unpublished manuscripts"],
  ])("never caches %s (%s)", (pathname) => {
    expect(ok(pathname)).toBe(false);
  });

  it("never caches an API data response — those can be per-user", () => {
    expect(ok("/api/products")).toBe(false);
    expect(ok("/api/customers/me")).toBe(false);
    expect(ok("/api/orders?limit=10")).toBe(false);
  });

  it("is anchored, so a lookalike collection cannot match", () => {
    expect(ok("/api/media-private/file/secret.pdf")).toBe(false);
    expect(ok("/api/blog-media/file/x.webp")).toBe(false);
  });

  it("cannot be reached by burying the segment deeper in the path", () => {
    expect(ok("/api/documents/file/../media/file/x.webp")).toBe(false);
    expect(ok("/proxy/api/media/file/x.webp")).toBe(false);
  });

  it("requires an actual filename after the prefix", () => {
    expect(ok("/api/media/file/")).toBe(false);
  });

  it.each([404, 401, 403, 500, 304, 206])("does not cache a %s response", (status) => {
    expect(ok("/api/media/file/x.webp", { status })).toBe(false);
  });

  it("caching a 404 for a year would outlive the upload that fixes it", () => {
    expect(ok("/api/media/file/not-uploaded-yet.webp", { status: 404 })).toBe(false);
  });

  it("never overrides a Cache-Control the upstream already chose", () => {
    expect(ok("/api/media/file/x.webp", { hasCacheControl: true })).toBe(false);
  });

  it("ignores the query string when matching", () => {
    // shouldCacheMedia only ever receives a pathname; prove a query-looking
    // suffix on a non-media path still cannot sneak through.
    expect(ok("/api/products")).toBe(false);
    expect(ok("/api/media/file/photo.webp")).toBe(true);
  });
});
