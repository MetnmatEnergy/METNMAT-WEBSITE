/**
 * Regenerates apps/website/legacy-redirects.mjs.
 *
 *   node apps/website/scripts/build-legacy-redirects.mjs [out] [legacyOrigin] [cmsOrigin]
 *
 * Reads the legacy Wix store sitemap and the live CMS catalogue, then maps each
 * legacy product URL onto its .com equivalent using only PROVABLE rules (see the
 * header it writes into the generated file). Read-only against both sources.
 */
import fs from "node:fs";

const OUT = process.argv[2] || new URL("../legacy-redirects.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const LEGACY = process.argv[3] || "https://www.metnmat.in";
const CMS = process.argv[4] || "https://admin.metnmat.com";

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

// Legacy product slugs, straight from the Wix store sitemap.
const storeXml = await fetchText(`${LEGACY}/store-products-sitemap.xml`);
const legacy = [
  ...new Set(
    [...storeXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].trim())
      .filter((u) => u.includes("/product-page/"))
      .map((u) => decodeURIComponent(u.split("/product-page/")[1]))
  ),
].sort();

// Current catalogue slugs, straight from the CMS.
const cat = JSON.parse(await fetchText(`${CMS}/api/products?limit=500&depth=0`));
const nw = [...new Set((cat.docs || []).map((d) => d.slug).filter(Boolean))].sort();
const newSet = new Set(nw);

if (!legacy.length || !nw.length) {
  throw new Error(`refusing to generate from empty input (legacy ${legacy.length}, catalogue ${nw.length})`);
}

// Tokens that carry no identity (they appear in nearly every lab-equipment slug),
// so they must not be what makes two different products look alike.
const STOP = new Set(["the", "of", "for", "and", "with", "a", "to", "in", "cell", "set", "setup", "unit"]);
const tok = (s) => new Set(s.split("-").filter((w) => w && !STOP.has(w)));

// Hand-verified pairs the mechanical rules can't see: abbreviation expansions
// (PFSA = perfluorosulfonic acid) and reordered/reformatted specs. Each was
// checked by reading BOTH product names, not by string similarity.
const MANUAL = {
  "kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad":
    "kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control",
  "photovoltaic-biased-photoelectrochemical-cell":
    "photovoltaic-pv-biased-photoelectrochemical-cell-pec",
  "pfsa-proton-exchange-membrane-n115-100x100-mm":
    "perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem",
  "detachable-l-shaped-platinum-disk-electrode-φ4mm":
    "detachable-l-shaped-platinum-disk-electrode-4-mm",
  "microbial-fuel-cell-stack": "microbial-fuel-cell-stack-ma-mfc-5",
};

const rows = [];
const unmatched = [];

for (const l of legacy) {
  // 1. Exact slug carried over.
  if (newSet.has(l)) {
    rows.push([l, l, "exact"]);
    continue;
  }
  // 2. Hand-verified.
  if (MANUAL[l] && newSet.has(MANUAL[l])) {
    rows.push([l, MANUAL[l], "verified"]);
    continue;
  }
  // 3. The .com slug is a PREFIX of the legacy slug — the catalogue import
  //    truncated long names. Provably the same product. Long prefixes only.
  const pref = nw.filter((x) => x.length >= 40 && l.startsWith(x));
  if (pref.length === 1) {
    rows.push([l, pref[0], "truncated"]);
    continue;
  }
  // 4. The .com slug's identity tokens are a SUBSET of the legacy slug's — the
  //    legacy page was a size/rod/length VARIANT of a base product we still sell
  //    (…-reference-electrode-φ6-70mm  →  …-reference-electrode). Requires a
  //    unique winner so a variant can never land on an unrelated material.
  const L = tok(l);
  const subs = nw.filter((x) => {
    const X = tok(x);
    if (X.size < 3) return false;
    for (const t of X) if (!L.has(t)) return false;
    return true;
  });
  if (subs.length) {
    // Most specific surviving candidate wins.
    subs.sort((a, b) => tok(b).size - tok(a).size);
    if (subs.length === 1 || tok(subs[0]).size > tok(subs[1]).size) {
      rows.push([l, subs[0], "variant"]);
      continue;
    }
  }
  unmatched.push(l);
}

rows.sort((a, b) => a[0].localeCompare(b[0]));

const by = (k) => rows.filter((r) => r[2] === k).length;
console.error(
  `products: ${rows.length}/${legacy.length} mapped ` +
    `(exact ${by("exact")}, truncated ${by("truncated")}, variant ${by("variant")}, verified ${by("verified")}); ` +
    `${unmatched.length} → /shop/all`
);
if (process.env.SHOW_UNMATCHED) console.error(unmatched.map((u) => "  unmatched: " + u).join("\n"));

const esc = (s) => JSON.stringify(s);

// A number of legacy slugs carry a literal "φ" (e.g. …-electrode-φ4mm). The
// browser sends that percent-encoded, and whether Next matches the raw or the
// decoded pathname is version-dependent — so emit BOTH spellings. The one that
// doesn't match is inert, and the redirect works either way.
const sourceForms = (slug) => {
  const enc = encodeURI(slug);
  return enc === slug ? [slug] : [slug, enc];
};
const productRow = (from, to, how) =>
  sourceForms(from)
    .map(
      (s) =>
        `  { source: ${esc(`/product-page/${s}`)}, destination: ${esc(`/shop/p/${to}`)}, permanent: true }, // ${how}`
    )
    .join("\n");

const file = `// AUTO-GENERATED — do not hand-edit. Regenerate with:
//   node apps/website/scripts/build-legacy-redirects.mjs
//
// Legacy metnmat.in (Wix) URLs → their metnmat.com equivalents, so inbound links
// and still-indexed legacy URLs that arrive here resolve instead of 404ing.
//
// Source of truth: the live Wix sitemaps
//   /pages-sitemap.xml (33)  /store-products-sitemap.xml (100)  /blog-posts-sitemap.xml (26)
// captured 2026-07-31.
//
// Product mapping rules — every entry is provable, none are guesses:
//   exact      the slug carried over unchanged
//   truncated  the .com slug is a prefix of the legacy slug (import truncated long names)
//   variant    the .com slug's identity tokens are a strict subset of the legacy
//              slug's, with a unique winner — a size/rod variant collapsing onto
//              the base product we still sell
//   verified   hand-checked pair (abbreviation expansion / reordered spec)
// Anything that did not satisfy one of those falls through to the /product-page/:slug
// wildcard and lands on /shop/all. Deliberate: a near-miss redirect would send a
// customer who wanted a GOLD electrode to a GLASSY CARBON one.
//
// Blog: the 26 legacy posts share zero slugs with the 3 posts on .com, so
// /post/:slug goes to the blog index rather than inventing equivalences.

/** @type {{source: string, destination: string, permanent: boolean}[]} */
export const legacyRedirects = [
  // ---- Wix pages -------------------------------------------------------
${[
  ["/request-a-quote", "/quote"],
  ["/privacy-policy", "/privacy"],
  ["/case-studies", "/projects"],
  ["/our-research", "/projects"],
  ["/our-team", "/about"],
  ["/home-1", "/"],
  ["/home-2", "/"],
  ["/projects-1", "/projects"],
  ["/shop-1", "/shop"],
  ["/services-1", "/services"],
  ["/productinfo", "/shop/all"],
  ["/shipping", "/replacement-policy"],
  ["/thank-you", "/"],
  ["/range-of-analysis", "/services"],
  // Wix per-service pages → the matching card on the single /services page.
  ["/applied-researchandconsultancy", "/services#applied-research-consultancy"],
  ["/product-process-development", "/services#product-process-development"],
  ["/process-quality-improvement", "/services#process-quality-improvement"],
  ["/product-benchmarking", "/services#product-benchmarking"],
  ["/materials-testing", "/services#materials-testing-characterization"],
  ["/material-processing-facilities", "/services#materials-processing-facilities"],
  // Wix "blank-N" placeholders, mapped by what each page actually held.
  // /blank-2 is deliberately absent — it had no discernible content, so it
  // keeps returning a correct 404.
  ["/blank", "/quote"],
  ["/blank-1", "/terms"],
  ["/blank-3", "/support"],
  ["/blank-4", "/account/orders"],
  ["/blank-5", "/account/orders"],
]
  .map(([s, d]) => `  { source: ${esc(s)}, destination: ${esc(d)}, permanent: true },`)
  .join("\n")}

  // ---- Store products (${rows.length} of ${legacy.length} resolve to a specific product) ----
${rows.map(([from, to, how]) => productRow(from, to, how)).join("\n")}

  // ---- Catch-alls (MUST stay last: first match wins) --------------------
  // The remaining ${unmatched.length} legacy products have no equivalent we can prove.
  { source: "/product-page/:slug", destination: "/shop/all", permanent: true },
  { source: "/post/:slug", destination: "/blog", permanent: true },
];
`;

fs.writeFileSync(OUT, file);
console.error(`wrote ${OUT}`);
