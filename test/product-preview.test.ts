import { describe, it, expect, afterEach } from "vitest";
import { Products } from "../apps/dashboard/src/collections/Products";
import { productPreviewUrl, previewSignature } from "../apps/dashboard/src/lib/preview-link";
import { previewTokenValid } from "../apps/website/src/backend/lib/preview-token";

/**
 * The Preview button used to point at the public product URL. The storefront
 * serves published products only, so the button 404'd for exactly the documents
 * it exists to show. These pin the two halves that fix it: the CMS mints a
 * signed link at the website's draft-preview route, and the CMS lets the website
 * SERVER (and only the server) read the draft.
 */

const SECRET = "a-real-32-byte-looking-secret-value";
const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

const previewOf = (slug: string): string | null =>
  (Products.admin!.preview as unknown as (d: Record<string, unknown>, o: unknown) => string | null)(
    { slug },
    { locale: "en", req: {}, token: null },
  );

const readAccess = (headers: Record<string, string>, user: unknown = null) =>
  (Products.access!.read as unknown as (a: unknown) => unknown)({
    req: { user, headers: new Headers(headers) },
  });

describe("product Preview button", () => {
  it("points at the draft-preview route, not the public product URL", () => {
    process.env.WEBSITE_URL = "https://site.test";
    process.env.CMS_PREVIEW_KEY = SECRET;
    const url = previewOf("reference-electrode")!;
    // FAILS BEFORE: today this is exactly https://site.test/shop/p/reference-electrode
    expect(url).not.toBe("https://site.test/shop/p/reference-electrode");
    expect(url.startsWith("https://site.test/api/shop/preview?")).toBe(true);
  });

  it("still returns null for a document with no slug", () => {
    process.env.CMS_PREVIEW_KEY = SECRET;
    expect(previewOf("")).toBeNull();
  });

  it("falls back to the public URL when no usable secret is configured", () => {
    delete process.env.CMS_PREVIEW_KEY;
    delete process.env.INTERNAL_API_KEY;
    process.env.WEBSITE_URL = "https://site.test";
    expect(previewOf("reference-electrode")).toBe("https://site.test/shop/p/reference-electrode");
  });
});

describe("preview token: the CMS signs what the website verifies", () => {
  const parse = (url: string) => {
    const q = new URL(url).searchParams;
    return { slug: q.get("slug")!, exp: q.get("exp")!, sig: q.get("sig")! };
  };

  it("round-trips", () => {
    const t = parse(productPreviewUrl({ slug: "ph-probe", websiteUrl: "https://site.test", secret: SECRET }));
    expect(previewTokenValid({ ...t, secret: SECRET })).toBe(true);
  });

  it("rejects a swapped slug, a stretched expiry and a wrong secret", () => {
    const t = parse(productPreviewUrl({ slug: "ph-probe", websiteUrl: "https://site.test", secret: SECRET }));
    expect(previewTokenValid({ ...t, slug: "secret-product", secret: SECRET })).toBe(false);
    expect(previewTokenValid({ ...t, exp: String(Number(t.exp) + 1), secret: SECRET })).toBe(false);
    expect(previewTokenValid({ ...t, secret: "another-secret-entirely-here-ok" })).toBe(false);
  });

  it("expires", () => {
    const now = 1_000_000;
    const t = parse(
      productPreviewUrl({ slug: "ph-probe", websiteUrl: "https://site.test", secret: SECRET, now }),
    );
    expect(previewTokenValid({ ...t, secret: SECRET, now: now + 59 * 60 * 1000 })).toBe(true);
    expect(previewTokenValid({ ...t, secret: SECRET, now: now + 61 * 60 * 1000 })).toBe(false);
  });

  it("fails CLOSED on an unset or placeholder secret rather than validating everything", () => {
    const exp = String(Date.now() + 60_000);
    for (const bad of ["", "   ", "PLACEHOLDER_SET_ME", undefined]) {
      expect(
        previewTokenValid({
          slug: "ph-probe",
          exp,
          sig: previewSignature("ph-probe", exp, bad ?? ""),
          secret: bad as string | undefined,
        }),
      ).toBe(false);
    }
  });

  it("rejects a slug that is not a slug (no path traversal into the redirect)", () => {
    const exp = String(Date.now() + 60_000);
    const slug = "../../admin";
    expect(
      previewTokenValid({ slug, exp, sig: previewSignature(slug, exp, SECRET), secret: SECRET }),
    ).toBe(false);
  });
});

describe("products read access", () => {
  it("lets the website server read drafts with the internal key", () => {
    process.env.CMS_PREVIEW_KEY = SECRET;
    // FAILS BEFORE: today this returns the published-only gate.
    expect(readAccess({ "x-internal-key": SECRET })).toBe(true);
  });

  it("still hides drafts from anonymous callers, customers and a wrong key", () => {
    process.env.CMS_PREVIEW_KEY = SECRET;
    delete process.env.INTERNAL_API_KEY;
    const gate = { _status: { equals: "published" } };
    expect(readAccess({})).toEqual(gate);
    expect(readAccess({ "x-internal-key": "wrong-key-of-same-ish-len" })).toEqual(gate);
    expect(readAccess({}, { collection: "customers" })).toEqual(gate);
  });

  it("never authenticates the published Terraform placeholder", () => {
    process.env.CMS_PREVIEW_KEY = "PLACEHOLDER_SET_ME";
    process.env.INTERNAL_API_KEY = "PLACEHOLDER_SET_ME";
    expect(readAccess({ "x-internal-key": "PLACEHOLDER_SET_ME" })).toEqual({
      _status: { equals: "published" },
    });
  });

  it("still lets staff see everything", () => {
    expect(readAccess({}, { collection: "users" })).toBe(true);
  });
});
