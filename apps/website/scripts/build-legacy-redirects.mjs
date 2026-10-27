/**
 * Regenerates apps/website/legacy-redirects.mjs.
 *
 *   node apps/website/scripts/build-legacy-redirects.mjs [out] [legacyOrigin] [cmsOrigin]
 *
 * Reads the legacy Wix sitemaps (frozen in scripts/legacy-in-snapshot/ since the
 * cutover) and the live CMS catalogue, then maps each legacy
 * product URL onto its .com equivalent. Read-only against both sources.
 *
 * Matching is done against PRODUCT DATA (body material, form factor, size
 * options), not slug string similarity. An earlier version compared slug tokens
 * and shipped real errors: `platinum-counter-electrode` is not a family page, it
 * is one SKU (MT-CE-PTSH-303, a platinum SHEET), so token-subset matching sent
 * every platinum wire/ring/spiral URL to a sheet. Slug text does not carry the
 * spec; the product record does.
 *
 * The map only ever GROWS. Wix renames product slugs, and a slug that has left
 * the live sitemap is still in Google's index and in other sites' links — so
 * every source in the current output is re-read and kept, re-matched against
 * today's catalogue like any other legacy URL.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// fileURLToPath, not URL.pathname: the pathname is percent-encoded, so a checkout
// under a directory with a space in its name ("HP VICTUS 1") wrote somewhere else.
const OUT = process.argv[2] || fileURLToPath(new URL("../legacy-redirects.mjs", import.meta.url));
const LEGACY = process.argv[3] || "https://www.metnmat.in";
const CMS = process.argv[4] || "https://admin.metnmat.com";

const fetchText = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

// Since 2026-10-27 metnmat.in itself redirects to .com, so its Wix sitemaps are
// no longer reachable at that address. The copies captured on 2026-10-26, the
// last day the Wix site served them, are the source of truth from now on.
const SNAPSHOT = fileURLToPath(new URL("./legacy-in-snapshot/", import.meta.url));
const legacySitemap = (name) =>
  fs.existsSync(path.join(SNAPSHOT, name))
    ? fs.readFileSync(path.join(SNAPSHOT, name), "utf8")
    : fetchText(`${LEGACY}/${name}`);

const storeXml = await legacySitemap("store-products-sitemap.xml");
const live = new Set(
  [...storeXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter((u) => u.includes("/product-page/"))
    .map((u) => decodeURIComponent(u.split("/product-page/")[1]))
);

// Everything the previous run mapped, so a renamed Wix slug keeps its redirect.
let previous = [];
if (fs.existsSync(OUT)) {
  previous = (await import(pathToFileURL(OUT).href)).legacyRedirects;
}
const historical = new Set(
  previous
    .map((r) => r.source)
    .filter((s) => s.startsWith("/product-page/") && !s.includes(":"))
    .map((s) => decodeURIComponent(s.slice("/product-page/".length)))
);
const legacy = [...new Set([...live, ...historical])].sort();

const cat = JSON.parse(await fetchText(`${CMS}/api/products?limit=500&depth=0`)).docs || [];
const bySlug = new Map(cat.map((p) => [p.slug, p]));
const categories = new Set(
  (JSON.parse(await fetchText(`${CMS}/api/categories?limit=500&depth=0`)).docs || []).map((c) => c.slug)
);

if (live.size < 50 || cat.length < 50 || categories.size < 5) {
  throw new Error(
    `refusing to generate from suspect input (legacy ${live.size}, catalogue ${cat.length}, categories ${categories.size})`
  );
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

// Hand-verified pairs: products whose name was reordered, abbreviated or
// re-worded between the two sites. Each was checked against BOTH live pages —
// the Wix <title> and the catalogue record agree on model, size and (unless
// noted) price — never on string similarity alone.
const MANUAL = {
  "400-w-metnmat-fuel-cell-metal-air-battery-testing-device": "fuel-cell-metal-air-battery-testing-device-400-w",
  "5-cm-pem-fuel-cell-hardware": "pem-fuel-cell-hardware",
  "anion-exchange-membrane-fumasep-faa-3-50-100x100-mm": "fumasep-faa-3-50-anion-exchange-membrane",
  "pfsa-proton-exchange-membrane-n115-100x100-mm": "perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem",
  // Both Kamoer slugs: the catalogue renamed these pumps (they were
  // kamoer-kcp-x-mini-… and kamoer-kcp2-kxf-s08-… on .com) and now files them
  // under compact-peristaltic-pump-…; the product names still read "Kamoer KCP-X
  // Mini (19–65 mL/min, 24 V)" and "Kamoer KCP2-KXF-S08 (17–50 mL/min, 12 V DC)".
  // Wix prices the KCP-X at ₹7,649, .com at ₹5,500 — same pump, different price.
  "kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad":
    "compact-peristaltic-pump-knob-control-65-ml-min",
  "kamoer-kcp-x-mini-peristaltic-pump-24v": "compact-peristaltic-pump-knob-control-65-ml-min",
  "kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-flow-rate-17-50-ml-min":
    "compact-peristaltic-pump-knob-control-41-5-ml-min",
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
  // ---- Verified 2026-10-26, Wix title ↔ catalogue record, same price ----
  "5cm2-research-scale-electrolyzer-cell": "5-cm2-research-scale-electrolyzer-cell-graphite-nickel-serpentine-flow-field", // ₹1,58,000
  "flow-electrolyzer-co2-reduction-peek": "flow-electrolyzer-for-carbon-dioxide-reduction-peek-body", // ₹85,000
  "flow-electrolyzer-co2-reduction-ptfe": "flow-electrolyzer-for-carbon-dioxide-reduction-ptfe-body", // ₹75,000
  "fumion-dispersion-fumion-faa-3-solut-10": "fumion-faa-3-solut-10-anion-exchange-ionomer-dispersion", // ₹6,500
  "gas-diffusion-layer-gdl-carbon-paper": "gas-diffusion-layer-gdl-carbon-paper-for-co2-electrolysis-flow-cell", // ₹9,000
  "gas-sampling-bag-1-l-pvdf-film-ptfe-valve": "gas-sampling-bag-1-litre-with-ptfe-valve", // ₹1,500
  // MT-WE-AUDS-2KF, "Ø2 mm, PTCFE Rod" on both (Wix ₹12,900, .com ₹15,000).
  "gold-disk-electrode-straight-type-ptcfe-rod-φ2mm": "detachable-gold-disk-electrode-2-mm",
  // MEA Thermopress Model 2000, 20 ton, 0–120 MPa, plates to 20 × 20 cm. ₹4,50,000.
  "hydraulic-hot-press-pem-fuel-cell-mea": "hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p",
  // Model T1 Zn-air / Al-air cell; the catalogue page covers T1–T4. ₹15,000.
  "metal-air-battery-test-cell": "metal-air-battery-reactor",
  "microbial-fuel-cell-mfc-dual-chamber-reactor": "microbial-fuel-cell-mfc-reactor", // ₹88,500
  // The Wix slug says Nafion, but the page it serves is titled "PFSA Proton
  // Exchange Membrane, 300 x 300 mm" — the generic PFSA/PTFE sheet. ₹29,750.
  "nafion-117-membrane": "pfsa-proton-exchange-membrane-300-mm-x-300-mm",
  "nickel-foam-electrode-110-ppi-200x300mm": "nickel-foam-electrode-200-300-1-5-mm", // 110 PPI, 1.5 mm, ₹2,125
  "non-aqueous-silver-silver-ion-reference-electrode-ag-ag-glass-rod": "non-aqueous-silver-silver-ion-reference-electrode-ag-ag", // ₹5,399
  // Wix drops the subscript in "CO₂RR", so "co2rr" became "co-rr". ₹1,78,000.
  "peek-co-rr-gas-diffusion-flow-cell-20-20-mm-co-electrochemical-flow-cell":
    "peek-co2rr-gas-diffusion-flow-cell-20-20-mm-co2-electrochemical-flow-cell",
  "photocatalyst-panel-reactor-for-hydrogen-generation": "photocatalytic-water-splitting-panel-reactors-app-400", // ₹1,35,400
  "piperion-aem-20-microns-self-supporting": "piperion-aem", // 20 µm self-supporting, ₹18,500
  "ptfe-electrode-holder": "ptfe-replaceable-electrode-holder-mpg-10", // MPG-10, gold-plated clip, ₹5,999
  "titanium-felt-electrode-porous-ti-felt": "titanium-felt-electrode", // ₹3,500
  // Wix "PMMA Water Splitting Cell with Gas Collection", 2/3-electrode = EWB. ₹6,000.
  "water-splitting-reactor": "ewb-water-splitting-reactor",
  "water-splitting-reactor-ewf-zero-gap-electrolyzer-acrylic-transparent-model": "ewf-transparent-flow-electrolyzer-zero-gap", // Model EWF, ₹50,000
  // ---- Created on .com 2026-10-27 from these very Wix pages (same name, price,
  //      specs and photos; apps/dashboard/scripts/draft-products/metnmat-in-missing-2026-10.json) ----
  "100-ml-100-ml-h-type-electrochemical-h-cell-dual-chamber-reactor": "h-type-electrochemical-cell-100-100-ml",
  "30-ml-30-ml-h-type-electrochemical-h-cell-dual-chamber-electrochemical-cell": "h-type-electrochemical-cell-30-30-ml",
  // The single 100 mL jacketed cell (₹42,000) — NOT the two-chamber 100 mL
  // water-jacketed H-cell (₹65,000), which is a different product.
  "100-ml-water-jacketed-electrochemical-cell-three-electrode": "water-jacketed-electrochemical-cell-100-ml",
  "50-ml-single-chamber-electrochemical-cell-glass-reactor": "single-chamber-electrochemical-cell-50-ml",
  "graphite-felt-electrode-for-electrochemical-applications-200x200x3mm": "graphite-felt-electrode-200-200-3-mm",
  "nickel-fiber-felt-electrode-material-porous-ni-felt-hydrogen-fuel-cell-diffusion": "nickel-fiber-felt-electrode-10-10-cm",
  "pem-hydrogen-electrolyzer-cell-60-ml-min": "pem-hydrogen-electrolyzer-60-ml-min",
  "piperion-anion-exchange-dispersion-5-wt-20-ml": "piperion-anion-exchange-ionomer-dispersion-5-wt-20-ml",
  "ptfe-40ml-water-splitting-electrochemical-reactor-three-electrode-system": "ptfe-water-splitting-reactor-40-ml-three-electrode",
};

// Legacy products with NO counterpart in the catalogue yet. Each lands on the
// category a buyer of that product would browse, not on the whole shop — the
// closest page we actually have. When the product itself is added to the
// catalogue, delete its line here and add it to MANUAL (the 9 that were here
// until 2026-10-27 were all created on .com and moved).
const CATEGORY = {};

// Fail loudly rather than silently dropping a stale hand entry.
for (const [from, to] of Object.entries(MANUAL)) {
  if (!bySlug.has(to)) throw new Error(`MANUAL target no longer in catalogue: ${to}`);
  if (!legacy.includes(from)) throw new Error(`MANUAL source is neither live nor historical: ${from}`);
}
for (const [from, to] of Object.entries(CATEGORY)) {
  if (!categories.has(to)) throw new Error(`CATEGORY target no longer exists: ${to}`);
  if (!legacy.includes(from)) throw new Error(`CATEGORY source is neither live nor historical: ${from}`);
}

// The CMS caps slugs at ~70 chars, so a catalogue slug at the cap that prefixes
// a longer legacy slug is a genuine truncation of the same name. Anything
// shorter is a different, more general product name and must NOT match here.
const TRUNCATION_CAP = 68;

// The catalogue re-created many Wix products under the Wix slug minus the "φ"
// sign (and minus Wix's "galss" typo): graphite-rod-counter-electrode-φ6-120mm
// is graphite-rod-counter-electrode-6-120mm. That is the same name, so it is
// an exact match — and it beats the spec matcher, which would pick the family
// page that lists 120 mm as one size option over the dedicated 120 mm page.
const normalize = (s) => s.replace(/φ/g, "").replace(/galss/g, "glass").replace(/-{2,}/g, "-").replace(/-$/, "");

// The previous run's product destinations, for historical slugs that nothing
// below can re-derive.
const previousTarget = new Map(
  previous
    .filter((r) => r.source.startsWith("/product-page/") && !r.source.includes(":"))
    .map((r) => [decodeURIComponent(r.source.slice("/product-page/".length)), r.destination])
);

const rows = [];
const unmatched = [];
for (const L of legacy) {
  let to = null;
  let how = "";
  if (bySlug.has(L)) [to, how] = [`/shop/p/${L}`, "exact"];
  else if (bySlug.has(normalize(L))) [to, how] = [`/shop/p/${normalize(L)}`, "normalized"];
  else if (MANUAL[L]) [to, how] = [`/shop/p/${MANUAL[L]}`, "verified"];
  else {
    const trunc = cat.map((p) => p.slug).filter((s) => s.length >= TRUNCATION_CAP && L.startsWith(s));
    if (trunc.length === 1) [to, how] = [`/shop/p/${trunc[0]}`, "truncated"];
    else {
      const m = matchByData(L);
      if (m) [to, how] = [`/shop/p/${m}`, "spec-match"];
      else if (CATEGORY[L]) [to, how] = [`/shop/c/${CATEGORY[L]}`, "category"];
      else {
        // A historical slug the matchers can no longer place keeps its old
        // destination — but only while that destination still exists.
        const prev = previousTarget.get(L);
        const prevSlug = prev?.startsWith("/shop/p/") ? prev.slice("/shop/p/".length) : null;
        if (prevSlug && bySlug.has(prevSlug)) [to, how] = [prev, "carried"];
      }
    }
  }
  if (to) rows.push([L, to, how]);
  else unmatched.push(L);
}

rows.sort((a, b) => a[0].localeCompare(b[0]));
const by = (k) => rows.filter((r) => r[2] === k).length;
const KINDS = ["exact", "normalized", "truncated", "spec-match", "verified", "carried", "category"];
console.error(
  `products: ${rows.length}/${legacy.length} mapped (${live.size} live, ${legacy.length - live.size} historical; ` +
    KINDS.map((k) => `${k} ${by(k)}`).join(", ") +
    `); ${unmatched.length} → /shop/all`
);
if (process.env.SHOW_UNMATCHED) console.error(unmatched.map((u) => "  unmatched: " + u).join("\n"));
// A live Wix product that lands on /shop/all is a ranking signal thrown away.
// Every one must be mapped by hand (MANUAL) or to its category (CATEGORY).
const liveUnmatched = unmatched.filter((u) => live.has(u));
if (liveUnmatched.length) {
  throw new Error(`live legacy products with no mapping:\n  ${liveUnmatched.join("\n  ")}`);
}

// ---------------------------------------------------------------------------
// Wix pages. Every path in the live pages sitemap must be accounted for: mapped
// here, served at the same path on .com, or knowingly left to 404.
const PAGES = [
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
  ["/blank", "/quote"],
  ["/blank-1", "/terms"],
  ["/blank-3", "/support"],
  // /blank-4 is "Order Tracking" and /blank-5 is "tracking-status" on the legacy
  // site (confirmed from their live <title>s). Not /account/orders: that is
  // `Disallow: /account` in robots.txt AND 307s to /login, so a crawler cannot
  // follow it and a logged-out customer hits a sign-in wall instead of help.
  ["/blank-4", "/support"],
  ["/blank-5", "/support"],
  // Wix store/member boilerplate. None has an equivalent; /account would be
  // robots-disallowed and auth-walled, so each goes where its visitor was headed.
  ["/gift-card", "/shop"],
  ["/members", "/"],
  ["/my-addresses", "/"],
];
// /blank-2 ("HOMW3", an abandoned homepage draft) has no content to preserve,
// so it is left to a correct 404.
const DELIBERATE_404 = new Set(["/blank-2"]);
const SITE = "https://www.metnmat.com";

const pagesXml = await legacySitemap("pages-sitemap.xml");
const livePages = [...pagesXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => new URL(m[1].trim()).pathname.replace(/\/$/, "") || "/"
);
const mappedPages = new Set(PAGES.map(([s]) => s));
const samePath = livePages.filter((p) => !mappedPages.has(p) && !DELIBERATE_404.has(p));
for (const p of samePath) {
  const res = await fetch(`${SITE}${p}`, { redirect: "manual" });
  if (res.status !== 200) {
    throw new Error(`legacy page ${p} is unmapped and ${SITE}${p} answers ${res.status} — add it to PAGES`);
  }
}

const postsXml = await legacySitemap("blog-posts-sitemap.xml");
const livePostPaths = [...postsXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => new URL(m[1].trim()).pathname)
  .filter((p) => p.startsWith("/post/"));
const livePosts = livePostPaths.length;

// ---------------------------------------------------------------------------
// .com product slugs that were renamed outside the CMS hook that records
// product-slug-redirects, so their old URLs — once redirect destinations here,
// and still in Google's index — 404. Every previous destination that has left
// the catalogue must be listed, or the run fails.
const COM_RENAMED = {
  "intelligent-peristaltic-pump-dual-channel-dc-24v": "intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v",
  "kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control": "compact-peristaltic-pump-knob-control-65-ml-min",
  "kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min": "compact-peristaltic-pump-knob-control-41-5-ml-min",
};
const previousRenamed = new Map(
  previous.filter((r) => r.source.startsWith("/shop/p/")).map((r) => [r.source.slice("/shop/p/".length), r.destination])
);
const lostDestinations = [
  ...new Set(
    previous
      .map((r) => r.destination)
      .filter((d) => d.startsWith("/shop/p/"))
      .map((d) => d.slice("/shop/p/".length))
      .filter((s) => !bySlug.has(s))
  ),
];
for (const s of lostDestinations) {
  if (!COM_RENAMED[s] && !previousRenamed.has(s)) throw new Error(`catalogue slug ${s} vanished — add it to COM_RENAMED`);
}
for (const [from, to] of Object.entries(COM_RENAMED)) {
  if (bySlug.has(from)) throw new Error(`COM_RENAMED source is a live product again: ${from}`);
  if (!bySlug.has(to)) throw new Error(`COM_RENAMED target no longer in catalogue: ${to}`);
}

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
    .map((s) => `  { source: ${esc(`/product-page/${s}`)}, destination: ${esc(to)}, statusCode: 301 }, // ${how}`)
    .join("\n");
const today = new Date().toISOString().slice(0, 10);

// Every URL metnmat.in has served, as it appears on the wire (φ percent-encoded).
// Historical paths are kept like historical redirects: Google still has them.
const previousPaths = fs.existsSync(OUT) ? ((await import(pathToFileURL(OUT).href)).legacyInPaths ?? []) : [];
const inPaths = [
  ...new Set([
    ...previousPaths,
    ...livePages,
    ...legacy.map((s) => `/product-page/${encodeURI(s)}`),
    ...livePostPaths,
  ]),
].sort();

const file = `// AUTO-GENERATED — do not hand-edit. Regenerate with:
//   node apps/website/scripts/build-legacy-redirects.mjs
//
// Legacy metnmat.in (Wix) URLs → their metnmat.com equivalents. Served two ways:
// on www.metnmat.com for old links that arrive here, and — through
// legacy-domain.mjs — on metnmat.in itself once that domain points at this host,
// as one 301 straight to the absolute .com URL.
//
// Source of truth: the live Wix sitemaps
//   /pages-sitemap.xml (${livePages.length})  /store-products-sitemap.xml (${live.size})  /blog-posts-sitemap.xml (${livePosts})
// plus the live CMS catalogue (${cat.length} products) and every source of the
// previous run (the map only grows). Captured ${today}.
//
// Product mappings, strongest first:
//   exact       the slug carried over unchanged
//   normalized  the same slug minus Wix's "φ" sign (and its "galss" typo)
//   truncated   the .com slug is at the ~70-char slug cap and prefixes the legacy
//               slug — a genuine truncation of the same name
//   spec-match  chemistry, body material (glass/PTFE/PEEK), form factor
//               (sheet/wire/ring/rod/mesh/disk) and dimensions all agree with the
//               product's own spec table and size options
//   verified    hand-checked pair: the Wix page and the catalogue record agree on
//               model, size and price (see MANUAL in the generator)
//   carried     a historical Wix slug kept on its previous, still-live destination
//   category    no counterpart in the catalogue yet — the category a buyer of it
//               would browse (see CATEGORY in the generator)
// Only a slug none of those can place falls through to /product-page/:slug and
// /shop/all, and the generator refuses to run while any LIVE Wix product would.
//
// Why the spec table and not the slug: "platinum-counter-electrode" reads like a
// family page but is a single SKU (MT-CE-PTSH-303, a platinum SHEET). Matching on
// slug tokens sent every platinum wire, ring and spiral URL to a sheet. Body
// material and form factor are not decoration on a reference electrode — they
// decide whether the probe fits the customer's cell.
//
// Blog: the ${livePosts} legacy posts share no subject with the posts on .com, so
// /post/:slug goes to the blog index rather than inventing equivalences.

/** @type {{source: string, destination: string, statusCode: number}[]} */
export const legacyRedirects = [
  // ---- Wix pages -------------------------------------------------------
${PAGES.map(([s, d]) => `  { source: ${esc(s)}, destination: ${esc(d)}, statusCode: 301 },`).join("\n")}

  // ---- Store products (${rows.length} of ${legacy.length} resolve to a product or its category) ----
${rows.map(([from, to, how]) => productRow(from, to, how)).join("\n")}

  // ---- Renamed .com product slugs ---------------------------------------
  // Renamed outside the CMS hook, so product-slug-redirects never recorded them.
  // If a product ever takes one of these slugs again, delete its line first.
${Object.entries({ ...Object.fromEntries(previousRenamed), ...Object.fromEntries(Object.entries(COM_RENAMED).map(([k, v]) => [k, `/shop/p/${v}`])) })
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([from, to]) => `  { source: ${esc(`/shop/p/${from}`)}, destination: ${esc(to)}, statusCode: 301 },`)
  .join("\n")}

  // ---- Catch-alls (MUST stay last: first match wins) --------------------
  // ${unmatched.length} historical legacy product(s) have no equivalent we can prove.
  { source: "/product-page/:slug", destination: "/shop/all", statusCode: 301 },
  { source: "/post/:slug", destination: "/blog", statusCode: 301 },
];

// Every URL metnmat.in has served (${inPaths.length}): pages, products current and
// historical, and posts. Once metnmat.in points at this host it serves this list
// as its own sitemap.xml (legacy-domain.mjs), so Google recrawls each old URL
// and finds its redirect instead of waiting to stumble on it.
/** @type {string[]} */
export const legacyInPaths = ${JSON.stringify(inPaths, null, 2)};
`;

fs.writeFileSync(OUT, file);
console.error(`wrote ${OUT}`);
