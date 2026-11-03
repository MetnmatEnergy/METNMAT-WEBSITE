import { describe, it, expect } from "vitest";
import nextConfig from "../apps/dashboard/next.config.mjs";
// The matcher Next itself applies to `headers()` sources.
import { getPathMatch } from "../apps/dashboard/node_modules/next/dist/shared/lib/router/utils/path-match.js";

/**
 * The CMS sends X-Robots-Tag: noindex on everything it serves, because it is
 * the operations console. Product photos are the exception: the storefront
 * embeds them from /api/media/file/, and a noindex there kept every product
 * photo out of Google Images.
 */
async function headersFor(pathname: string): Promise<Record<string, string>> {
  const rules = await nextConfig.headers!();
  const out: Record<string, string> = {};
  for (const rule of rules) {
    if (getPathMatch(rule.source, { removeUnnamedParams: true, strict: true })(pathname) === false) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

describe("CMS X-Robots-Tag", () => {
  it("keeps the admin and the API out of search", async () => {
    for (const p of ["/", "/admin", "/admin/collections/products", "/api/products", "/api/media", "/api/users/me"]) {
      expect((await headersFor(p))["X-Robots-Tag"], p).toBe("noindex, nofollow, noarchive");
    }
  });

  it("lets Google index the product photos the storefront embeds", async () => {
    const h = await headersFor("/api/media/file/Metal-Air%20Battery%20Reactor-10-1600x1200.webp");
    expect(h["X-Robots-Tag"]).toBeUndefined();
    // The hardening headers still apply to media.
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=/);
  });
});
