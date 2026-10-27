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
 * The two files metnmat.in answers ITSELF instead of redirecting.
 *
 * Google consolidates an old URL only when it recrawls it and meets the 301, and
 * left alone it revisits a small site's pages over weeks. A sitemap that lists
 * every old URL, served on the old host and submitted in its Search Console
 * property, makes it recrawl them now — Google's own site-move advice. The
 * robots.txt beside it allows everything and points at that sitemap: redirecting
 * it instead would hand .in the .com file, whose Sitemap line names the wrong
 * host. Both are rewritten to app/legacy-in/*, which 404s on any other host.
 */
export const LEGACY_SELF_SERVED = {
  "/sitemap.xml": "/legacy-in/sitemap.xml",
  "/robots.txt": "/legacy-in/robots.txt",
};

/**
 * Host-scoped copies of the legacy map with absolute destinations, then the
 * Wix-only shapes, then a same-path catch-all for everything else on .in
 * (/, /about, /contact, /services …) — except the two self-served files above.
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
  // Three rules rather than one "/:path*", because a redirect cannot step aside
  // for a later rewrite: the single-segment rule is the only one that could
  // match /sitemap.xml or /robots.txt, so it alone carries the exclusion.
  const selfServed = Object.keys(LEGACY_SELF_SERVED)
    .map((p) => p.slice(1).replace(/\./g, "\\."))
    .join("$|");
  return [
    ...scoped,
    { source: "/", has: [LEGACY_HOST], destination: `${CANONICAL_ORIGIN}/`, statusCode: 301 },
    {
      source: `/:segment((?!${selfServed}$)[^/]+)`,
      has: [LEGACY_HOST],
      destination: `${CANONICAL_ORIGIN}/:segment`,
      statusCode: 301,
    },
    { source: "/:segment/:rest+", has: [LEGACY_HOST], destination: `${CANONICAL_ORIGIN}/:segment/:rest+`, statusCode: 301 },
  ];
}

/** beforeFiles rewrites: on metnmat.in, the self-served files go to app/legacy-in/*. */
export function legacyDomainRewrites() {
  return Object.entries(LEGACY_SELF_SERVED).map(([source, destination]) => ({
    source,
    has: [LEGACY_HOST],
    destination,
  }));
}

/** True when a Host header names metnmat.in or www.metnmat.in. */
export function isLegacyHost(host) {
  const hostname = (host ?? "").split(":", 1)[0].toLowerCase();
  return new RegExp(`^${LEGACY_HOST.value}$`).test(hostname);
}

const LEGACY_ORIGIN = "https://www.metnmat.in";

/**
 * The old host's sitemap: every URL metnmat.in ever served, each of which now
 * 301s. No <lastmod> — the move date is when DNS changes, which no build knows,
 * and a guessed date is worse than none.
 *
 * @param {string[]} paths
 */
export function renderLegacySitemap(paths) {
  const xmlEscape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const urls = paths.map((p) => `<url><loc>${xmlEscape(`${LEGACY_ORIGIN}${p}`)}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

/** The old host's robots.txt: crawl everything, so every redirect is seen. */
export function renderLegacyRobots() {
  return `User-Agent: *\nAllow: /\n\nSitemap: ${LEGACY_ORIGIN}/sitemap.xml\n`;
}
