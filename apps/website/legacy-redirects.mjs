// AUTO-GENERATED — do not hand-edit. Regenerate with:
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

/** @type {{source: string, destination: string, statusCode: number}[]} */
export const legacyRedirects = [
  // ---- Wix pages -------------------------------------------------------
  { source: "/request-a-quote", destination: "/quote", statusCode: 301 },
  { source: "/privacy-policy", destination: "/privacy", statusCode: 301 },
  { source: "/case-studies", destination: "/projects", statusCode: 301 },
  { source: "/our-research", destination: "/projects", statusCode: 301 },
  { source: "/our-team", destination: "/about", statusCode: 301 },
  { source: "/home-1", destination: "/", statusCode: 301 },
  { source: "/home-2", destination: "/", statusCode: 301 },
  { source: "/projects-1", destination: "/projects", statusCode: 301 },
  { source: "/shop-1", destination: "/shop", statusCode: 301 },
  { source: "/services-1", destination: "/services", statusCode: 301 },
  { source: "/productinfo", destination: "/shop/all", statusCode: 301 },
  { source: "/shipping", destination: "/replacement-policy", statusCode: 301 },
  { source: "/thank-you", destination: "/", statusCode: 301 },
  { source: "/range-of-analysis", destination: "/services", statusCode: 301 },
  { source: "/applied-researchandconsultancy", destination: "/services#applied-research-consultancy", statusCode: 301 },
  { source: "/product-process-development", destination: "/services#product-process-development", statusCode: 301 },
  { source: "/process-quality-improvement", destination: "/services#process-quality-improvement", statusCode: 301 },
  { source: "/product-benchmarking", destination: "/services#product-benchmarking", statusCode: 301 },
  { source: "/materials-testing", destination: "/services#materials-testing-characterization", statusCode: 301 },
  { source: "/material-processing-facilities", destination: "/services#materials-processing-facilities", statusCode: 301 },
  { source: "/blank", destination: "/quote", statusCode: 301 },
  { source: "/blank-1", destination: "/terms", statusCode: 301 },
  { source: "/blank-3", destination: "/support", statusCode: 301 },
  // /blank-4 is "Order Tracking" and /blank-5 is "tracking-status" on the legacy
  // site (confirmed from their live <title>s). Both used to point at
  // /account/orders, which is a dead end for the visitor these redirects exist
  // to serve: it is `Disallow: /account` in robots.txt AND 307s to /login, so a
  // crawler cannot follow it and a logged-out customer arriving from an old link
  // hits a sign-in wall instead of help. There is no public order-tracking page
  // — tracking lives inside the account — so /support is the real equivalent.
  { source: "/blank-4", destination: "/support", statusCode: 301 },
  { source: "/blank-5", destination: "/support", statusCode: 301 },

  // ---- Store products (65 of 100 resolve to a specific product) ----
  { source: "/product-page/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model-mhp-30", destination: "/shop/p/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model", statusCode: 301 }, // truncated
  { source: "/product-page/400-w-metnmat-fuel-cell-metal-air-battery-testing-device", destination: "/shop/p/fuel-cell-metal-air-battery-testing-device-400-w", statusCode: 301 }, // verified
  { source: "/product-page/5-cm-pem-fuel-cell-hardware", destination: "/shop/p/pem-fuel-cell-hardware", statusCode: 301 }, // verified
  { source: "/product-page/aluminum-sheet", destination: "/shop/p/aluminum-sheet", statusCode: 301 }, // exact
  { source: "/product-page/anion-exchange-membrane-fumasep-faa-3-50-100x100-mm", destination: "/shop/p/fumasep-faa-3-50-anion-exchange-membrane", statusCode: 301 }, // verified
  { source: "/product-page/detachable-l-shaped-gold-disk-electrode-φ4mm", destination: "/shop/p/detachable-gold-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-gold-disk-electrode-%CF%864mm", destination: "/shop/p/detachable-gold-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-platinum-disk-electrode-φ4mm", destination: "/shop/p/detachable-l-shaped-platinum-disk-electrode-4-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-platinum-disk-electrode-%CF%864mm", destination: "/shop/p/detachable-l-shaped-platinum-disk-electrode-4-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-window", destination: "/shop/p/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-windo", statusCode: 301 }, // truncated
  { source: "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ4-70", destination: "/shop/p/hg-hgo-reference-electrode-6-70-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%864-70", destination: "/shop/p/hg-hgo-reference-electrode-6-70-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-φ3mm", destination: "/shop/p/glassy-carbon-electrode-straight-type-ptfe-rod", statusCode: 301 }, // spec-match
  { source: "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-%CF%863mm", destination: "/shop/p/glassy-carbon-electrode-straight-type-ptfe-rod", statusCode: 301 }, // spec-match
  { source: "/product-page/gold-disk-electrode-straight-type-ptfe-rod-φ2mm", destination: "/shop/p/detachable-gold-disk-electrode-2-mm-auds", statusCode: 301 }, // spec-match
  { source: "/product-page/gold-disk-electrode-straight-type-ptfe-rod-%CF%862mm", destination: "/shop/p/detachable-gold-disk-electrode-2-mm-auds", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-plate-counter-electrode-10-10mm-thickness-3mm", destination: "/shop/p/graphite-counter-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-φ6-120mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-120mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-φ6-60mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-60mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-φ6-80mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-80mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/high-purity-zinc-sheet", destination: "/shop/p/high-purity-zinc-sheet", statusCode: 301 }, // exact
  { source: "/product-page/high-temperature-pem-aem-electrolyzer-hardware", destination: "/shop/p/high-temperature-pem-aem-electrolyzer-hardware", statusCode: 301 }, // exact
  { source: "/product-page/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-press-mach", destination: "/shop/p/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p", statusCode: 301 }, // truncated
  { source: "/product-page/hydraulic-pressing-machine", destination: "/shop/p/hydraulic-pressing-machine", statusCode: 301 }, // exact
  { source: "/product-page/intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v", destination: "/shop/p/intelligent-peristaltic-pump-dual-channel-dc-24v", statusCode: 301 }, // verified
  { source: "/product-page/kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad", destination: "/shop/p/kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control", statusCode: 301 }, // verified
  { source: "/product-page/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-flow-rate-17-50-ml-min", destination: "/shop/p/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-%CF%863mm", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm-1", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-%CF%863mm-1", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-φ6-95mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-%CF%866-95mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/manganese-dioxide-nanoparticles", destination: "/shop/p/manganese-dioxide-nanoparticles", statusCode: 301 }, // exact
  { source: "/product-page/mercurous-sulfate-reference-electrode-hg-hg2so4", destination: "/shop/p/mercurous-sulfate-reference-electrode-hg-hg2so4", statusCode: 301 }, // exact
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ6-70mm", destination: "/shop/p/hg-hgo-reference-electrode-6-70-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%866-70mm", destination: "/shop/p/hg-hgo-reference-electrode-6-70-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-φ4-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-%CF%864-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-φ6-60mm", destination: "/shop/p/hg-hgo-reference-electrode-6-60-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-%CF%866-60mm", destination: "/shop/p/hg-hgo-reference-electrode-6-60-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/microbial-fuel-cell-stack", destination: "/shop/p/microbial-fuel-cell-stack-ma-mfc-5", statusCode: 301 }, // verified
  { source: "/product-page/pfsa-proton-exchange-membrane-n115-100x100-mm", destination: "/shop/p/perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem", statusCode: 301 }, // verified
  { source: "/product-page/photovoltaic-biased-photoelectrochemical-cell", destination: "/shop/p/photovoltaic-pv-biased-photoelectrochemical-cell-pec", statusCode: 301 }, // verified
  { source: "/product-page/platinum-counter-electrode-with-spring-shaped-pt-wire-electrode-sheath", destination: "/shop/p/platinum-spiral-counter-electrode", statusCode: 301 }, // verified
  { source: "/product-page/platinum-disk-electrode-straight-type-ptfe-rod-φ2mm", destination: "/shop/p/detachable-platinum-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-disk-electrode-straight-type-ptfe-rod-%CF%862mm", destination: "/shop/p/detachable-platinum-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-10-10mm", destination: "/shop/p/platinum-mesh-counter-electrode-30-30-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-20-20mm", destination: "/shop/p/platinum-mesh-counter-electrode-30-30-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-30-30mm", destination: "/shop/p/platinum-mesh-counter-electrode-30-30-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-sheet-counter-electrode-10-10-0-1mm", destination: "/shop/p/platinum-counter-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-sheet-counter-electrode-15-20-0-1mm", destination: "/shop/p/platinum-counter-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-sheet-counter-electrode-20-20-0-1mm", destination: "/shop/p/platinum-counter-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-sheet-counter-electrode-30-30-0-1mm", destination: "/shop/p/platinum-counter-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-φ0-5-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm-ptwk", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm-ptwk", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-φ0-5-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-φ1-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm-ptwk", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm-ptwk", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-φ1-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-ring-counter-electrode-φ0-5-100mm", destination: "/shop/p/platinum-ring-counter-electrode-0-5-230-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-100mm", destination: "/shop/p/platinum-ring-counter-electrode-0-5-230-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-ring-counter-electrode-φ0-5-230mm", destination: "/shop/p/platinum-ring-counter-electrode-0-5-230-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-230mm", destination: "/shop/p/platinum-ring-counter-electrode-0-5-230-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-φ5-75-50mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%865-75-50mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-φ6-70mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%866-70mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-peek-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ2-4-60mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-4-60mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ2-50mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-50mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ4-50mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-50mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ4-90mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-90mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6-140mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-140mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6-70mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-70mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6mm-ptfe-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866mm-ptfe-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/swagelok-battery-test-fixture", destination: "/shop/p/swagelok-battery-test-fixture", statusCode: 301 }, // exact
  { source: "/product-page/temperature-controlling-unit", destination: "/shop/p/temperature-controlling-unit", statusCode: 301 }, // exact
  { source: "/product-page/titanium-felt-electrode-porous-ti-felt-for-electrochemical-applications-fuel", destination: "/shop/p/titanium-felt-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/transparent-carbon-dioxide-gas-diffusion-flow-cell", destination: "/shop/p/transparent-carbon-dioxide-gas-diffusion-flow-cell", statusCode: 301 }, // exact
  { source: "/product-page/triboelectric-measurement-setup", destination: "/shop/p/triboelectric-measurement-setup", statusCode: 301 }, // exact
  { source: "/product-page/vanadium-flow-cell-reactor", destination: "/shop/p/vanadium-flow-cell-reactor", statusCode: 301 }, // exact
  { source: "/product-page/zero-gap-electrolyzer-for-carbon-dioxide-reduction", destination: "/shop/p/zero-gap-electrolyzer-for-carbon-dioxide-reduction", statusCode: 301 }, // exact

  // ---- Catch-alls (MUST stay last: first match wins) --------------------
  // The remaining 35 legacy products have no equivalent we can prove.
  { source: "/product-page/:slug", destination: "/shop/all", statusCode: 301 },
  { source: "/post/:slug", destination: "/blog", statusCode: 301 },
];
