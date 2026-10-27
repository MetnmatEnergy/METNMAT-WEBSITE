import { describe, it, expect } from "vitest";
// @ts-expect-error — generated .mjs data module, no types
import { legacyRedirects } from "../apps/website/legacy-redirects.mjs";
// @ts-expect-error — plain .mjs config helper, no types
import { legacyDomainRedirects, CANONICAL_ORIGIN, LEGACY_HOST } from "../apps/website/legacy-domain.mjs";

/**
 * metnmat.in → www.metnmat.com. The whole point of serving the old domain from
 * this app is that every .in URL reaches its .com page in ONE 301: a chain
 * leaks equity and makes crawlers walk it, and a relative Location would be
 * resolved against .in and bounce through it a second time.
 *
 * The resolver below is a deliberately small model of how Next evaluates
 * `redirects()` — first match wins; `has: host` is the Host header lower-cased,
 * port stripped, matched as ^value$; `:x` is one segment and `:x*` zero or more.
 * It covers exactly the source shapes these two files use, and the test pins
 * that, so a new shape fails here instead of being silently mis-modelled.
 */
type Rule = { source: string; destination: string; statusCode: number; has?: { type: string; value: string }[] };

const legacy = legacyRedirects as Rule[];
const domain = legacyDomainRedirects(legacy) as Rule[];
const all: Rule[] = [...domain, ...legacy]; // the order next.config.mjs returns them in

const SHAPE = /^(\/(?:[^/:]+|:[a-z]+\*?))+$|^\/:path\*$/;

function compile(source: string): RegExp {
  let re = "";
  for (const seg of source.split("/").slice(1)) {
    if (/^:[a-z]+\*$/.test(seg)) re += "(?:/(.*))?";
    else if (/^:[a-z]+$/.test(seg)) re += "/([^/]+)";
    else re += "/" + seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}/?$`);
}

function resolve(host: string, pathname: string): string | null {
  const hostname = host.split(":", 1)[0].toLowerCase();
  for (const r of all) {
    if (r.has?.some((h) => h.type === "host" && !new RegExp(`^${h.value}$`).test(hostname))) continue;
    const m = compile(r.source).exec(pathname);
    if (!m) continue;
    let i = 1;
    return r.destination.replace(/:[a-z]+\*?/g, () => m[i++] ?? "");
  }
  return null;
}

const pathOf = (url: string) => new URL(url, CANONICAL_ORIGIN).pathname;

describe("metnmat.in → www.metnmat.com", () => {
  it("uses only source shapes the resolver models", () => {
    const odd = all.map((r) => r.source).filter((s) => !SHAPE.test(s));
    expect(odd).toEqual([]);
  });

  it("forwards to the production origin, absolute, with a literal 301", () => {
    expect(CANONICAL_ORIGIN).toBe("https://www.metnmat.com");
    for (const r of domain) {
      expect(r.destination.startsWith(`${CANONICAL_ORIGIN}/`), r.source).toBe(true);
      expect(r.statusCode, r.source).toBe(301);
      expect(r.has, r.source).toEqual([LEGACY_HOST]);
    }
  });

  it("puts every .in rule before every host-less rule, and the catch-all last of them", () => {
    // A host-less rule matched first would answer an .in request with a
    // RELATIVE Location — resolved against .in, it costs a second hop.
    expect(all.slice(0, domain.length).every((r) => r.has)).toBe(true);
    expect(domain.at(-1)?.source).toBe("/:path*");
  });

  it("matches the apex and www of metnmat.in, and nothing else", () => {
    const hostRe = new RegExp(`^${LEGACY_HOST.value}$`);
    for (const h of ["metnmat.in", "www.metnmat.in"]) expect(hostRe.test(h), h).toBe(true);
    for (const h of ["metnmat.com", "www.metnmat.com", "admin.metnmat.com", "notmetnmat.in", "metnmat.in.evil.com", "wwwxmetnmat.in"]) {
      expect(hostRe.test(h), h).toBe(false);
    }
  });

  it("sends every legacy URL to its .com page in exactly one hop, on both .in hosts", () => {
    const literal = legacy.filter((r) => !r.source.includes(":"));
    expect(literal.length).toBeGreaterThan(150);
    const chains: string[] = [];
    for (const host of ["www.metnmat.in", "metnmat.in", "WWW.METNMAT.IN:443"]) {
      for (const r of literal) {
        const to = resolve(host, r.source);
        expect(to, `${host}${r.source}`).toBe(`${CANONICAL_ORIGIN}${r.destination}`);
        // …and the page it lands on is not itself a redirect.
        const next = resolve("www.metnmat.com", pathOf(to!));
        if (next) chains.push(`${r.source} -> ${to} -> ${next}`);
      }
    }
    expect(chains).toEqual([]);
  });

  it("keeps the path for pages that exist on both sites", () => {
    for (const p of ["/", "/about", "/contact", "/services", "/shop", "/blog", "/projects", "/robots.txt", "/sitemap.xml"]) {
      expect(resolve("www.metnmat.in", p), p).toBe(`${CANONICAL_ORIGIN}${p}`);
    }
  });

  it("handles Wix-only URL shapes — store categories, blog listings, unknown products and posts", () => {
    expect(resolve("www.metnmat.in", "/category/all-products")).toBe(`${CANONICAL_ORIGIN}/shop/all`);
    expect(resolve("www.metnmat.in", "/blog/categories/metallurgy")).toBe(`${CANONICAL_ORIGIN}/blog`);
    expect(resolve("www.metnmat.in", "/blog/page/2")).toBe(`${CANONICAL_ORIGIN}/blog`);
    expect(resolve("www.metnmat.in", "/product-page/a-product-wix-never-listed")).toBe(`${CANONICAL_ORIGIN}/shop/all`);
    expect(resolve("www.metnmat.in", "/post/introduction-to-metallurgy")).toBe(`${CANONICAL_ORIGIN}/blog`);
  });

  it("never touches requests for www.metnmat.com itself", () => {
    for (const p of ["/", "/shop", "/category/all-products", "/blog/page/2", "/shop/p/aluminum-sheet"]) {
      expect(resolve("www.metnmat.com", p), p).toBeNull();
    }
    // The shared legacy map still answers old links that arrive at .com directly.
    expect(resolve("www.metnmat.com", "/product-page/aluminum-sheet")).toBe("/shop/p/aluminum-sheet");
  });
});
