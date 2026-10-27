// metnmat.in → www.metnmat.com, one 301 per URL.
//
// metnmat.in is the old Wix site. While it stays live it competes with this one
// for every query, and it wins: it is years older, carries the inbound links, and
// serves the same products — so Google files our product pages as duplicates of
// its own and shows .in. A 301 from each .in URL to its .com equivalent is the
// signal that ends that and moves the equity across (docs/seo/DOMAIN-CONSOLIDATION.md).
//
// These rules do nothing until metnmat.in resolves to this host. Once it does,
// Caddy proxies it here with its own Host header, and the FIRST matching rule
// below answers — before middleware and before the host-less legacy rules,
// which would otherwise send a relative Location that the browser resolves
// against metnmat.in and turn one hop into two.
//
// Every destination is absolute and pinned to the production origin rather than
// NEXT_PUBLIC_SITE_URL: a misconfigured build env must never be able to point
// the old domain's equity at localhost or a staging host.

/** The one origin metnmat.in forwards to. */
export const CANONICAL_ORIGIN = "https://www.metnmat.com";

/**
 * Next matches a `host` condition against the Host header lower-cased, port
 * stripped, and anchored at both ends — so this is exactly the apex and www.
 */
export const LEGACY_HOST = { type: "host", value: "(?:www\\.)?metnmat\\.in" };

// Wix URL shapes that exist only on metnmat.in. On www.metnmat.com these paths
// belong to nobody, so they are scoped to the legacy host rather than added to
// the shared map, where /blog/categories/* could one day shadow a real route.
const WIX_ONLY = [
  // Store category listings (/category/all-products, …).
  { source: "/category/:slug*", destination: "/shop/all" },
  // Blog listings, tag and pagination pages.
  { source: "/blog/categories/:slug*", destination: "/blog" },
  { source: "/blog/hashtags/:slug*", destination: "/blog" },
  { source: "/blog/page/:page*", destination: "/blog" },
];

/**
 * Host-scoped copies of the legacy map with absolute destinations, then the
 * Wix-only shapes, then a same-path catch-all for everything else on .in
 * (/, /about, /contact, /services, /robots.txt, /sitemap.xml …).
 *
 * @param {{source: string, destination: string, statusCode: number}[]} legacyRedirects
 */
export function legacyDomainRedirects(legacyRedirects) {
  const scoped = [...legacyRedirects, ...WIX_ONLY.map((r) => ({ ...r, statusCode: 301 }))].map((r) => ({
    source: r.source,
    has: [LEGACY_HOST],
    destination: `${CANONICAL_ORIGIN}${r.destination}`,
    statusCode: 301,
  }));
  return [
    ...scoped,
    { source: "/:path*", has: [LEGACY_HOST], destination: `${CANONICAL_ORIGIN}/:path*`, statusCode: 301 },
  ];
}
