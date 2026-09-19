import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeReturnPath } from "../apps/website/src/frontend/lib/preview-exit";
import { publicOrigin } from "../apps/website/src/frontend/lib/public-origin";

/**
 * Leaving draft mode, and saying the right thing while in it (2026-09-19).
 *
 * The CMS Preview button sets a browser-wide draft-mode cookie and nothing
 * cleared it, so every product and article opened afterwards wore the red
 * "not public" banner — published ones included — and the owner read a
 * published product as unpublished. The banner now distinguishes the two and
 * links to /api/preview/exit, whose redirect target must stay on this origin.
 */

describe("safeReturnPath keeps the exit redirect on this origin", () => {
  it("accepts an ordinary same-origin path", () => {
    expect(safeReturnPath("/shop/p/test")).toBe("/shop/p/test");
    expect(safeReturnPath("/blog/co2-fuel-cells?x=1#top")).toBe("/blog/co2-fuel-cells?x=1#top");
  });

  it("falls back to the home page for anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/foo:bar", "", "  ", undefined, null]) {
      expect(safeReturnPath(bad as string), String(bad)).toBe("/");
    }
  });

  it("rejects header-injection characters", () => {
    expect(safeReturnPath("/shop\r\nSet-Cookie: x=y")).toBe("/");
  });
});

describe("publicOrigin sends the browser to the public site, not the server's own address", () => {
  // Behind Caddy, req.nextUrl.origin is 127.0.0.1:3100 — the Preview button
  // redirected the director to localhost in production (2026-09-19).
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

  it("prefers NEXT_PUBLIC_SITE_URL, the value the production build sets", () => {
    expect(publicOrigin(h({ host: "127.0.0.1:3100" }), { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://www.metnmat.com/" })).toBe(
      "https://www.metnmat.com",
    );
    expect(publicOrigin(h({ host: "localhost:3000" }), { NODE_ENV: "development", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });

  it("is the canonical site in production whatever the proxy says", () => {
    expect(publicOrigin(h({ host: "127.0.0.1:3100" }), { NODE_ENV: "production" })).toBe("https://www.metnmat.com");
    expect(publicOrigin(h({ host: "localhost:3100", "x-forwarded-host": "evil.example" }), { NODE_ENV: "production" })).toBe(
      "https://www.metnmat.com",
    );
  });

  it("follows the browser's host in development, honouring proxy headers", () => {
    expect(publicOrigin(h({ host: "localhost:3000" }), { NODE_ENV: "development" })).toBe("http://localhost:3000");
    expect(publicOrigin(h({ host: "127.0.0.1:3000", "x-forwarded-host": "dev.example", "x-forwarded-proto": "https" }), { NODE_ENV: "development" })).toBe(
      "https://dev.example",
    );
    expect(publicOrigin(h({}), { NODE_ENV: "test" })).toBe("http://localhost:3000");
  });

  it("every draft-mode route redirects through it — none through req.nextUrl.origin", () => {
    const ROOT = join(__dirname, "..");
    for (const p of ["shop/preview", "blog/preview", "preview/exit"]) {
      const src = readFileSync(join(ROOT, "apps", "website", "src", "app", "api", p, "route.ts"), "utf8");
      expect(src, p).toMatch(/publicOrigin\(req\.headers\)/);
      expect(src, p).not.toMatch(/req\.nextUrl\.origin/);
    }
  });
});

describe("the banner and the exit route are wired", () => {
  const ROOT = join(__dirname, "..");
  const read = (p: string) => readFileSync(join(ROOT, "apps", "website", "src", p), "utf8");

  it("the exit route disables draft mode and redirects through the validator", () => {
    const route = read("app/api/preview/exit/route.ts");
    expect(route).toMatch(/\(await draftMode\(\)\)\.disable\(\)/);
    expect(route).toMatch(/safeReturnPath\(req\.nextUrl\.searchParams\.get\("to"\)\)/);
  });

  it("product and article pages render the shared banner with the real publish state", () => {
    const product = read("app/shop/p/[slug]/page.tsx");
    const article = read("app/blog/[slug]/page.tsx");
    expect(product).toMatch(/<PreviewBanner published=\{published\} path=\{`\/shop\/p\/\$\{product\.slug\}`\} \/>/);
    expect(article).toMatch(/<PreviewBanner published=\{published\} path=\{`\/blog\/\$\{article\.slug\}`\} \/>/);
    expect(product).not.toMatch(/Draft preview — this version is not public\. Close this tab/);
    expect(article).not.toMatch(/Draft preview — this version is not public\. Close this tab/);
  });

  it("the banner links to the exit route and says 'published and live' for a published page", () => {
    const banner = read("frontend/components/preview-banner.tsx");
    expect(banner).toMatch(/\/api\/preview\/exit\?to=\$\{encodeURIComponent\(path\)\}/);
    expect(banner).toMatch(/published and live/);
    expect(banner).toMatch(/Press Publish in the CMS/);
  });
});
