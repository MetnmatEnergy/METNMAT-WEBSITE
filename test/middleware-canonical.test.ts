import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The canonical-host redirect exists for BROWSERS, which carry host-only session
 * cookies. It must not be applied to endpoints that MACHINES call.
 *
 * A payment provider carries no cookies and does not follow redirects on webhook
 * delivery: it sees the 308, records a failed delivery, and retries into the same
 * 308 until it gives up. Nothing on our side logs anything, because the request
 * never reaches the route. The only symptom is orders that stay unpaid while the
 * money has already moved.
 *
 * Confirmed against production before the fix: GET on the apex webhook path
 * answered 308.
 */

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;

async function loadMiddleware(siteUrl: string) {
  vi.resetModules();
  process.env.NEXT_PUBLIC_SITE_URL = siteUrl;
  return import("../apps/website/src/middleware");
}

type Middleware = Awaited<ReturnType<typeof loadMiddleware>>["middleware"];
type Req = Parameters<Middleware>[0];

/**
 * A stand-in for NextRequest carrying only what the middleware touches: the
 * host header and a cloneable nextUrl. `next/server` itself is not importable
 * from this directory — Next lives in apps/website/node_modules, and these tests
 * run from the repo root — and the middleware's own import of it resolves fine
 * because that module sits inside the app.
 */
const request = (url: string, host: string): Req => {
  const base = new URL(url);
  const nextUrl = Object.assign(new URL(url), { clone: () => new URL(base.toString()) });
  return { headers: new Headers({ host }), nextUrl } as unknown as Req;
};

beforeEach(() => vi.resetModules());
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("canonical host redirect", () => {
  it("sends the apex to www with a 308, preserving method and body", async () => {
    const { middleware } = await loadMiddleware("https://www.metnmat.com");
    const res = middleware(request("https://metnmat.com/shop", "metnmat.com"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://www.metnmat.com/shop");
  });

  it("leaves the canonical host alone", async () => {
    const { middleware } = await loadMiddleware("https://www.metnmat.com");
    const res = middleware(request("https://www.metnmat.com/shop", "www.metnmat.com"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("keeps the query string across the redirect", async () => {
    const { middleware } = await loadMiddleware("https://www.metnmat.com");
    const res = middleware(request("https://metnmat.com/blog?page=2", "metnmat.com"));
    expect(res.headers.get("location")).toBe("https://www.metnmat.com/blog?page=2");
  });

  it("ignores hosts outside our own domain", async () => {
    const { middleware } = await loadMiddleware("https://www.metnmat.com");
    for (const host of ["localhost:3000", "10.0.0.4", "some-probe.internal"]) {
      const res = middleware(request(`http://${host}/api/health`, host));
      expect(res.status, host).toBe(200);
    }
  });

  // ── The webhook ───────────────────────────────────────────────────────────
  it("does NOT redirect the payment webhook, on either host", async () => {
    const { middleware } = await loadMiddleware("https://www.metnmat.com");

    const apex = middleware(
      request("https://metnmat.com/api/checkout/webhook", "metnmat.com")
    );
    expect(apex.status).toBe(200);
    expect(apex.headers.get("location")).toBeNull();

    const www = middleware(
      request("https://www.metnmat.com/api/checkout/webhook", "www.metnmat.com")
    );
    expect(www.status).toBe(200);
  });

  it("exempts the webhook path EXACTLY, not by prefix", async () => {
    // A prefix match would exempt /api/checkout/webhook-anything, quietly
    // widening the hole this opens to keep one machine endpoint reachable.
    const { middleware } = await loadMiddleware("https://www.metnmat.com");
    const res = middleware(
      request("https://metnmat.com/api/checkout/webhook/extra", "metnmat.com")
    );
    expect(res.status).toBe(308);
  });

  it("still redirects other API routes, which browsers do call", async () => {
    const { middleware } = await loadMiddleware("https://www.metnmat.com");
    const res = middleware(request("https://metnmat.com/api/quote", "metnmat.com"));
    expect(res.status).toBe(308);
  });

  it("does nothing at all when no canonical origin is configured", async () => {
    const { middleware } = await loadMiddleware("");
    const res = middleware(request("https://metnmat.com/shop", "metnmat.com"));
    expect(res.status).toBe(200);
  });
});
