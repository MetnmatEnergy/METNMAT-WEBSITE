// AUTO-GENERATED — do not hand-edit. Regenerate with:
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
  { source: "/request-a-quote", destination: "/quote", permanent: true },
  { source: "/privacy-policy", destination: "/privacy", permanent: true },
  { source: "/case-studies", destination: "/projects", permanent: true },
  { source: "/our-research", destination: "/projects", permanent: true },
  { source: "/our-team", destination: "/about", permanent: true },
  { source: "/home-1", destination: "/", permanent: true },
  { source: "/home-2", destination: "/", permanent: true },
  { source: "/projects-1", destination: "/projects", permanent: true },
  { source: "/shop-1", destination: "/shop", permanent: true },
  { source: "/services-1", destination: "/services", permanent: true },
  { source: "/productinfo", destination: "/shop/all", permanent: true },
  { source: "/shipping", destination: "/replacement-policy", permanent: true },
  { source: "/thank-you", destination: "/", permanent: true },
  { source: "/range-of-analysis", destination: "/services", permanent: true },
  { source: "/applied-researchandconsultancy", destination: "/services#applied-research-consultancy", permanent: true },
  { source: "/product-process-development", destination: "/services#product-process-development", permanent: true },
  { source: "/process-quality-improvement", destination: "/services#process-quality-improvement", permanent: true },
  { source: "/product-benchmarking", destination: "/services#product-benchmarking", permanent: true },
  { source: "/materials-testing", destination: "/services#materials-testing-characterization", permanent: true },
  { source: "/material-processing-facilities", destination: "/services#materials-processing-facilities", permanent: true },
  { source: "/blank", destination: "/quote", permanent: true },
  { source: "/blank-1", destination: "/terms", permanent: true },
  { source: "/blank-3", destination: "/support", permanent: true },
  { source: "/blank-4", destination: "/account/orders", permanent: true },
  { source: "/blank-5", destination: "/account/orders", permanent: true },

  // ---- Store products (59 of 100 resolve to a specific product) ----
  { source: "/product-page/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model-mhp-30", destination: "/shop/p/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model", permanent: true }, // truncated
  { source: "/product-page/400-w-metnmat-fuel-cell-metal-air-battery-testing-device", destination: "/shop/p/fuel-cell-metal-air-battery-testing-device-400-w", permanent: true }, // variant
  { source: "/product-page/5-cm-pem-fuel-cell-hardware", destination: "/shop/p/pem-fuel-cell-hardware", permanent: true }, // variant
  { source: "/product-page/aluminum-sheet", destination: "/shop/p/aluminum-sheet", permanent: true }, // exact
  { source: "/product-page/anion-exchange-membrane-fumasep-faa-3-50-100x100-mm", destination: "/shop/p/fumasep-faa-3-50-anion-exchange-membrane", permanent: true }, // variant
  { source: "/product-page/detachable-l-shaped-gold-disk-electrode-φ4mm", destination: "/shop/p/detachable-gold-disk-electrode", permanent: true }, // variant
  { source: "/product-page/detachable-l-shaped-gold-disk-electrode-%CF%864mm", destination: "/shop/p/detachable-gold-disk-electrode", permanent: true }, // variant
  { source: "/product-page/detachable-l-shaped-platinum-disk-electrode-φ4mm", destination: "/shop/p/detachable-l-shaped-platinum-disk-electrode-4-mm", permanent: true }, // verified
  { source: "/product-page/detachable-l-shaped-platinum-disk-electrode-%CF%864mm", destination: "/shop/p/detachable-l-shaped-platinum-disk-electrode-4-mm", permanent: true }, // verified
  { source: "/product-page/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-window", destination: "/shop/p/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-windo", permanent: true }, // truncated
  { source: "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ4-70", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // variant
  { source: "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%864-70", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // variant
  { source: "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-φ3mm", destination: "/shop/p/glassy-carbon-electrode-straight-type-ptfe-rod", permanent: true }, // truncated
  { source: "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-%CF%863mm", destination: "/shop/p/glassy-carbon-electrode-straight-type-ptfe-rod", permanent: true }, // truncated
  { source: "/product-page/graphite-plate-counter-electrode-10-10mm-thickness-3mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/graphite-rod-counter-electrode-φ6-120mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-120mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/graphite-rod-counter-electrode-φ6-60mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-60mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/graphite-rod-counter-electrode-φ6-80mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-80mm", destination: "/shop/p/graphite-counter-electrode", permanent: true }, // variant
  { source: "/product-page/high-purity-zinc-sheet", destination: "/shop/p/high-purity-zinc-sheet", permanent: true }, // exact
  { source: "/product-page/high-temperature-pem-aem-electrolyzer-hardware", destination: "/shop/p/high-temperature-pem-aem-electrolyzer-hardware", permanent: true }, // exact
  { source: "/product-page/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-press-mach", destination: "/shop/p/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p", permanent: true }, // truncated
  { source: "/product-page/hydraulic-pressing-machine", destination: "/shop/p/hydraulic-pressing-machine", permanent: true }, // exact
  { source: "/product-page/intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v", destination: "/shop/p/intelligent-peristaltic-pump-dual-channel-dc-24v", permanent: true }, // variant
  { source: "/product-page/kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad", destination: "/shop/p/kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control", permanent: true }, // verified
  { source: "/product-page/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-flow-rate-17-50-ml-min", destination: "/shop/p/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min", permanent: true }, // variant
  { source: "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-φ6-95mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", permanent: true }, // variant
  { source: "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-%CF%866-95mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", permanent: true }, // variant
  { source: "/product-page/manganese-dioxide-nanoparticles", destination: "/shop/p/manganese-dioxide-nanoparticles", permanent: true }, // exact
  { source: "/product-page/mercurous-sulfate-reference-electrode-hg-hg2so4", destination: "/shop/p/mercurous-sulfate-reference-electrode-hg-hg2so4", permanent: true }, // exact
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ6-70mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // truncated
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%866-70mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // truncated
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-φ4-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // truncated
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-%CF%864-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // truncated
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-φ6-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // truncated
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-%CF%866-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", permanent: true }, // truncated
  { source: "/product-page/microbial-fuel-cell-stack", destination: "/shop/p/microbial-fuel-cell-stack-ma-mfc-5", permanent: true }, // verified
  { source: "/product-page/non-aqueous-silver-silver-ion-reference-electrode-ag-ag-glass-rod", destination: "/shop/p/non-aqueous-silver-silver-ion-reference-electrode-ag-ag", permanent: true }, // truncated
  { source: "/product-page/pfsa-proton-exchange-membrane-n115-100x100-mm", destination: "/shop/p/perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem", permanent: true }, // verified
  { source: "/product-page/photovoltaic-biased-photoelectrochemical-cell", destination: "/shop/p/photovoltaic-pv-biased-photoelectrochemical-cell-pec", permanent: true }, // verified
  { source: "/product-page/platinum-counter-electrode-with-spring-shaped-pt-wire-electrode-sheath", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-sheet-counter-electrode-10-10-0-1mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-sheet-counter-electrode-15-20-0-1mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-sheet-counter-electrode-20-20-0-1mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-sheet-counter-electrode-30-30-0-1mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-φ0-5-37mm-peek-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-peek-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-φ0-5-37mm-ptfe-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-ptfe-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-φ1-37mm-peek-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-peek-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-φ1-37mm-ptfe-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-ptfe-rod", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-ring-counter-electrode-φ0-5-100mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-100mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-ring-counter-electrode-φ0-5-230mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-230mm", destination: "/shop/p/platinum-counter-electrode", permanent: true }, // variant
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-φ5-75-50mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", permanent: true }, // variant
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%865-75-50mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", permanent: true }, // variant
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-φ6-70mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", permanent: true }, // variant
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%866-70mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", permanent: true }, // variant
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-peek-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ2-4-60mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-4-60mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ2-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ4-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ4-90mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-90mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6-140mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-140mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6-70mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-70mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6mm-ptfe-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866mm-ptfe-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", permanent: true }, // truncated
  { source: "/product-page/swagelok-battery-test-fixture", destination: "/shop/p/swagelok-battery-test-fixture", permanent: true }, // exact
  { source: "/product-page/temperature-controlling-unit", destination: "/shop/p/temperature-controlling-unit", permanent: true }, // exact
  { source: "/product-page/titanium-felt-electrode-porous-ti-felt-for-electrochemical-applications-fuel", destination: "/shop/p/titanium-felt-electrode", permanent: true }, // variant
  { source: "/product-page/transparent-carbon-dioxide-gas-diffusion-flow-cell", destination: "/shop/p/transparent-carbon-dioxide-gas-diffusion-flow-cell", permanent: true }, // exact
  { source: "/product-page/triboelectric-measurement-setup", destination: "/shop/p/triboelectric-measurement-setup", permanent: true }, // exact
  { source: "/product-page/vanadium-flow-cell-reactor", destination: "/shop/p/vanadium-flow-cell-reactor", permanent: true }, // exact
  { source: "/product-page/zero-gap-electrolyzer-for-carbon-dioxide-reduction", destination: "/shop/p/zero-gap-electrolyzer-for-carbon-dioxide-reduction", permanent: true }, // exact

  // ---- Catch-alls (MUST stay last: first match wins) --------------------
  // The remaining 41 legacy products have no equivalent we can prove.
  { source: "/product-page/:slug", destination: "/shop/all", permanent: true },
  { source: "/post/:slug", destination: "/blog", permanent: true },
];
