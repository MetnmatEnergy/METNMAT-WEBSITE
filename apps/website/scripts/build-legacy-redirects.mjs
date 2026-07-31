/**
 * Regenerates apps/website/legacy-redirects.mjs.
 *
 *   node apps/website/scripts/build-legacy-redirects.mjs [out] [legacyOrigin] [cmsOrigin]
 *
 * Reads the legacy Wix sitemaps and the live CMS catalogue, then maps each legacy
 * product URL onto its .com equivalent. Read-only against both sources.
 *
 * Matching is done against PRODUCT DATA (body material, form factor, size
 * options), not slug string similarity. An earlier version compared slug tokens
 * and shipped real errors: `platinum-counter-electrode` is not a family page, it
 * is one SKU (MT-CE-PTSH-303, a platinum SHEET), so token-subset matching sent
 * every platinum wire/ring/spiral URL to a sheet. Slug text does not carry the
 * spec; the product record does.
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

const storeXml = await fetchText(`${LEGACY}/store-products-sitemap.xml`);
const legacy = [
  ...new Set(
    [...storeXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].trim())
      .filter((u) => u.includes("/product-page/"))
      .map((u) => decodeURIComponent(u.split("/product-page/")[1]))
  ),
].sort();

const cat = JSON.parse(await fetchText(`${CMS}/api/products?limit=500&depth=0`)).docs || [];
const bySlug = new Map(cat.map((p) => [p.slug, p]));

if (legacy.length < 50 || cat.length < 50) {
  throw new Error(`refusing to generate from suspect input (legacy ${legacy.length}, catalogue ${cat.length})`);
}

// ---------------------------------------------------------------------------
// Vocabulary. These are the attributes that decide whether two lab electrodes
// are the same product. Getting any of them wrong ships a customer the wrong item.
const BODY = ["glass", "ptfe", "peek"];
const FORM = ["sheet", "plate", "wire", "ring", "spiral", "rod", "felt", "foam", "disk", "mesh"];
const FAMILY = [
  "platinum", "gold", "silver", "graphite", "glassy", "carbon", "titanium", "copper", "nickel",
  "agcl", "hgo", "hg2cl2", "hg2so4", "calomel", "mercury", "mercurous", "zinc", "aluminum",
];

// Compound chemistry names. If either side names one, both must — "silver" alone
// cannot distinguish Ag/AgCl from the non-aqueous Ag/Ag+ electrode, and they are
// different reference chemistries with different potentials.
const DISCRIMINATORS = ["agcl", "hgo", "hg2cl2", "hg2so4"];

const nums = (s) => (s.match(/\d+/g) || []).map(Number);
const runIn = (hay, needle) => {
  if (!needle.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((v, k) => hay[i + k] === v)) return true;
  return false;
};
const specOf = (p, re) =>
  (p.specs || []).find((s) => re.test(s.label || ""))?.value?.toLowerCase() || "";
// Two DIFFERENT spec labels that read alike:
//   "Body Material"   → the polymer/glass the body is made of (PTFE, PEEK, Glass)
//   "Body / Material" → the form factor (Sheet, Straight Type, Plate)
// Matching them loosely made "Body / Material = Straight Type" answer the
// question "what is this electrode's body material?" with "straight type",
// which then failed every polymer comparison. Keep them strictly apart.
// The material lookup also tolerates one product that spells it "Body Mateirial".
const bodyMaterialOf = (p) => specOf(p, /^body\s+mat/i);
const bodyTypeOf = (p) => specOf(p, /^body\s*\/\s*mat/i);
const famOf = (s) => new Set(FAMILY.filter((f) => s.includes(f)));
const formOf = (s) => new Set(FORM.filter((f) => new RegExp(`(^|-|\\s)${f}`).test(s)));
// Word-boundary: "glassy-carbon" must NOT read as a glass body.
const bodyOf = (s) => BODY.find((b) => new RegExp(`(^|-|\\s)${b}(-|\\s|$)`).test(s)) || "";
// Straight vs L-shaped is a different physical part, not a description.
const isL = (s) => /(^|-|\s)l-shaped(-|\s|$)/.test(s);
const isStraight = (s) => /(^|-|\s)straight(-|\s|$)/.test(s);

/** Data-driven match, or null when nothing is provable. */
function matchByData(L) {
  const lNums = nums(L);
  const lFam = famOf(L);
  const lForm = formOf(L);
  const lBody = bodyOf(L);
  if (!lFam.size) return null;

  const scored = [];
  for (const p of cat) {
    const hay = `${p.name} ${p.slug} ${p.shortDesc || ""}`.toLowerCase();
    // 1. Chemistry must overlap — never cross materials.
    if (![...lFam].some((f) => famOf(hay).has(f))) continue;
    // 1b. A named reference chemistry must match exactly on both sides.
    if (DISCRIMINATORS.some((d) => L.includes(d) !== hay.includes(d))) continue;
    // 2. Body material must agree. A candidate that declares none is NOT a
    //    match for a URL that names one — treating unknown as compatible is how
    //    a glassy-carbon electrode holder once matched a CO2 electrolyzer.
    const pBody = bodyMaterialOf(p) || bodyOf(hay);
    if (lBody && (!pBody || !pBody.includes(lBody))) continue;
    // 3. Form factor must agree when both declare one (sheet ≠ wire ≠ ring).
    const pForm = formOf(`${hay} ${bodyTypeOf(p)}`);
    if (lForm.size && pForm.size && ![...lForm].some((f) => pForm.has(f))) continue;
    // 3b. Straight and L-shaped are different parts — never substitute one.
    if (isStraight(L) && isL(hay)) continue;
    if (isL(L) && isStraight(hay)) continue;
    // 4. Dimensions must appear among the product's own size options. Score by
    //    how many numbers matched: "Ø6 mm" is a run inside [6,140], so a
    //    1-number size would otherwise tie with the real "Ø6 × 140 mm".
    const sizeLen = Math.max(0, ...(p.sizes || []).map((s) => (runIn(lNums, nums(s.label || "")) ? nums(s.label || "").length : 0)));
    scored.push({ slug: p.slug, sizeLen });
  }

  if (process.env.DEBUG_SLUG && L === process.env.DEBUG_SLUG) {
    console.error(`DEBUG ${L}\n  fam=${[...lFam]} form=${[...lForm]} body=${lBody} nums=${lNums}`);
    console.error(`  survivors: ${JSON.stringify(scored, null, 1)}`);
  }
  const sized = scored.filter((s) => s.sizeLen > 0).sort((a, b) => b.sizeLen - a.sizeLen);
  if (sized.length && (sized.length === 1 || sized[0].sizeLen > sized[1].sizeLen)) return sized[0].slug;
  // Dimensionless legacy URL: accept only one survivor AND only when it is the
  // same base name (its slug prefixes the legacy slug). Without the prefix
  // guard, "flow-electrolyzer-…-peek-body" fell through to an unrelated
  // transparent flow cell purely because it was the last candidate standing.
  if (!lNums.length && scored.length === 1 && L.startsWith(scored[0].slug)) return scored[0].slug;
  return null;
}

// Hand-verified equipment/membrane pairs: non-dimensional products where the
// name was reordered or an abbreviation expanded. Each was checked against both
// product records (SKU + name), not string similarity.
const MANUAL = {
  "400-w-metnmat-fuel-cell-metal-air-battery-testing-device": "fuel-cell-metal-air-battery-testing-device-400-w",
  "5-cm-pem-fuel-cell-hardware": "pem-fuel-cell-hardware",
  "anion-exchange-membrane-fumasep-faa-3-50-100x100-mm": "fumasep-faa-3-50-anion-exchange-membrane",
  "pfsa-proton-exchange-membrane-n115-100x100-mm": "perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem",
  "intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v": "intelligent-peristaltic-pump-dual-channel-dc-24v",
  "kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad":
    "kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control",
  "kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-flow-rate-17-50-ml-min":
    "kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min",
  "microbial-fuel-cell-stack": "microbial-fuel-cell-stack-ma-mfc-5",
  // Wix called it "spring-shaped Pt wire … sheath"; the catalogue calls the same
  // helical-wire-in-a-sheath part a spiral (MT-CE-PTSP-500).
  "platinum-counter-electrode-with-spring-shaped-pt-wire-electrode-sheath": "platinum-spiral-counter-electrode",
  // MT-WE-GCDL-3PT: L-shaped, glassy carbon, PTFE body, 3 mm disk — the same
  // part. The spec matcher rejects it because the legacy slug says "rod" (the
  // body) while the product says "disk" (the tip); loosening the form rule to
  // catch this would let genuinely different form factors through.
  "l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm": "l-shaped-glassy-carbon-disk-working-electrode-3-mm",
  "l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm-1": "l-shaped-glassy-carbon-disk-working-electrode-3-mm",
  "photovoltaic-biased-photoelectrochemical-cell": "photovoltaic-pv-biased-photoelectrochemical-cell-pec",
};
// Fail loudly rather than silently dropping a stale hand entry.
for (const [from, to] of Object.entries(MANUAL)) {
  if (!bySlug.has(to)) throw new Error(`MANUAL target no longer in catalogue: ${to}`);
  if (!legacy.includes(from)) throw new Error(`MANUAL source no longer in legacy sitemap: ${from}`);
}

// The CMS caps slugs at ~70 chars, so a catalogue slug at the cap that prefixes
// a longer legacy slug is a genuine truncation of the same name. Anything
// shorter is a different, more general product name and must NOT match here.
const TRUNCATION_CAP = 68;

const rows = [];
const unmatched = [];
for (const L of legacy) {
  let to = null;
  let how = "";
  if (bySlug.has(L)) [to, how] = [L, "exact"];
  else if (MANUAL[L]) [to, how] = [MANUAL[L], "verified"];
  else {
    const trunc = cat.map((p) => p.slug).filter((s) => s.length >= TRUNCATION_CAP && L.startsWith(s));
    if (trunc.length === 1) [to, how] = [trunc[0], "truncated"];
    else {
      const m = matchByData(L);
      if (m) [to, how] = [m, "spec-match"];
    }
  }
  if (to) rows.push([L, to, how]);
  else unmatched.push(L);
}

rows.sort((a, b) => a[0].localeCompare(b[0]));
const by = (k) => rows.filter((r) => r[2] === k).length;
console.error(
  `products: ${rows.length}/${legacy.length} mapped ` +
    `(exact ${by("exact")}, truncated ${by("truncated")}, spec-match ${by("spec-match")}, verified ${by("verified")}); ` +
    `${unmatched.length} → /shop/all`
);
if (process.env.SHOW_UNMATCHED) console.error(unmatched.map((u) => "  unmatched: " + u).join("\n"));

const esc = (s) => JSON.stringify(s);
// Several legacy slugs carry a literal "φ". Browsers send it percent-encoded,
// and whether Next matches the raw or decoded pathname is version-dependent —
// emit both. The spelling that doesn't match is inert.
const sourceForms = (slug) => {
  const enc = encodeURI(slug);
  return enc === slug ? [slug] : [slug, enc];
};
const productRow = (from, to, how) =>
  sourceForms(from)
    .map((s) => `  { source: ${esc(`/product-page/${s}`)}, destination: ${esc(`/shop/p/${to}`)}, permanent: true }, // ${how}`)
    .join("\n");

const file = `// AUTO-GENERATED — do not hand-edit. Regenerate with:
//   node apps/website/scripts/build-legacy-redirects.mjs
//
// Legacy metnmat.in (Wix) URLs → their metnmat.com equivalents, so inbound links
// and still-indexed legacy URLs that arrive here resolve instead of 404ing.
//
// Source of truth: the live Wix sitemaps
//   /pages-sitemap.xml (33)  /store-products-sitemap.xml (100)  /blog-posts-sitemap.xml (26)
// plus the live CMS catalogue. Captured 2026-07-31.
//
// Product mappings are derived from PRODUCT DATA, not slug similarity:
//   exact       the slug carried over unchanged
//   truncated   the .com slug is at the ~70-char slug cap and prefixes the legacy
//               slug — a genuine truncation of the same name
//   spec-match  chemistry, body material (glass/PTFE/PEEK), form factor
//               (sheet/wire/ring/rod/mesh/disk) and dimensions all agree with the
//               product's own spec table and size options
//   verified    hand-checked equipment/membrane pair (reordered name or expanded
//               abbreviation), confirmed against both product records
// Anything that satisfies none of those falls through to the /product-page/:slug
// wildcard and lands on /shop/all.
//
// Why the spec table and not the slug: "platinum-counter-electrode" reads like a
// family page but is a single SKU (MT-CE-PTSH-303, a platinum SHEET). Matching on
// slug tokens sent every platinum wire, ring and spiral URL to a sheet. Body
// material and form factor are not decoration on a reference electrode — they
// decide whether the probe fits the customer's cell.
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
