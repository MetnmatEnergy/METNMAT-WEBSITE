// AUTO-GENERATED — do not hand-edit. Regenerate with:
//   node apps/website/scripts/build-legacy-redirects.mjs
//
// Legacy metnmat.in (Wix) URLs → their metnmat.com equivalents. Served two ways:
// on www.metnmat.com for old links that arrive here, and — through
// legacy-domain.mjs — on metnmat.in itself once that domain points at this host,
// as one 301 straight to the absolute .com URL.
//
// Source of truth: the live Wix sitemaps
//   /pages-sitemap.xml (36)  /store-products-sitemap.xml (115)  /blog-posts-sitemap.xml (26)
// plus the live CMS catalogue (143 products) and every source of the
// previous run (the map only grows). Captured 2026-10-27.
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
// Blog: the 26 legacy posts share no subject with the posts on .com, so
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
  { source: "/blank-4", destination: "/support", statusCode: 301 },
  { source: "/blank-5", destination: "/support", statusCode: 301 },
  { source: "/gift-card", destination: "/shop", statusCode: 301 },
  { source: "/members", destination: "/", statusCode: 301 },
  { source: "/my-addresses", destination: "/", statusCode: 301 },

  // ---- Store products (119 of 119 resolve to a product or its category) ----
  { source: "/product-page/100-ml-100-ml-h-type-electrochemical-h-cell-dual-chamber-reactor", destination: "/shop/p/h-type-electrochemical-cell-100-100-ml", statusCode: 301 }, // verified
  { source: "/product-page/100-ml-water-jacketed-electrochemical-cell-three-electrode", destination: "/shop/p/water-jacketed-electrochemical-cell-100-ml", statusCode: 301 }, // verified
  { source: "/product-page/30-ml-30-ml-h-type-electrochemical-h-cell-dual-chamber-electrochemical-cell", destination: "/shop/p/h-type-electrochemical-cell-30-30-ml", statusCode: 301 }, // verified
  { source: "/product-page/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model-mhp-30", destination: "/shop/p/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model", statusCode: 301 }, // truncated
  { source: "/product-page/400-w-metnmat-fuel-cell-metal-air-battery-testing-device", destination: "/shop/p/fuel-cell-metal-air-battery-testing-device-400-w", statusCode: 301 }, // verified
  { source: "/product-page/5-cm-pem-fuel-cell-hardware", destination: "/shop/p/pem-fuel-cell-hardware", statusCode: 301 }, // verified
  { source: "/product-page/50-ml-single-chamber-electrochemical-cell-glass-reactor", destination: "/shop/p/single-chamber-electrochemical-cell-50-ml", statusCode: 301 }, // verified
  { source: "/product-page/5cm2-research-scale-electrolyzer-cell", destination: "/shop/p/5-cm2-research-scale-electrolyzer-cell-graphite-nickel-serpentine-flow-field", statusCode: 301 }, // verified
  { source: "/product-page/aluminum-sheet", destination: "/shop/p/aluminum-sheet", statusCode: 301 }, // exact
  { source: "/product-page/anion-exchange-membrane-fumasep-faa-3-50-100x100-mm", destination: "/shop/p/fumasep-faa-3-50-anion-exchange-membrane", statusCode: 301 }, // verified
  { source: "/product-page/conducting-carbon-fiber-cloth-ct-200mm-x-200mm", destination: "/shop/p/conducting-carbon-fiber-cloth-ct-200mm-x-200mm", statusCode: 301 }, // exact
  { source: "/product-page/copper-foam-200mm-x-300mm", destination: "/shop/p/copper-foam-200mm-x-300mm", statusCode: 301 }, // exact
  { source: "/product-page/detachable-gold-dsic-electrode-straight-type-peek-rod-sem-φ3mm", destination: "/shop/p/detachable-gold-disk-electrode-3-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-gold-dsic-electrode-straight-type-peek-rod-sem-%CF%863mm", destination: "/shop/p/detachable-gold-disk-electrode-3-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-gold-disk-electrode-φ4mm", destination: "/shop/p/detachable-gold-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-gold-disk-electrode-%CF%864mm", destination: "/shop/p/detachable-gold-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-platinum-disk-electrode-φ4mm", destination: "/shop/p/detachable-l-shaped-platinum-disk-electrode-4-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-l-shaped-platinum-disk-electrode-%CF%864mm", destination: "/shop/p/detachable-l-shaped-platinum-disk-electrode-4-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/detachable-peek-replaceable-glassy-carbon-electrode-holder", destination: "/shop/p/detachable-peek-replaceable-glassy-carbon-electrode-holder", statusCode: 301 }, // exact
  { source: "/product-page/detachable-peek-replaceable-platinum-electrode-holder", destination: "/shop/p/detachable-peek-replaceable-platinum-electrode-holder", statusCode: 301 }, // exact
  { source: "/product-page/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-window", destination: "/shop/p/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-windo", statusCode: 301 }, // truncated
  { source: "/product-page/electrowinning-system-pp-electrochemical-cell-with-ss316-titanium-electrodes", destination: "/shop/p/electrowinning-system-pp-electrochemical-cell-with-ss316-titanium-electrodes", statusCode: 301 }, // exact
  { source: "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ4-70", destination: "/shop/p/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-glass-rod-4-70", statusCode: 301 }, // normalized
  { source: "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%864-70", destination: "/shop/p/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-glass-rod-4-70", statusCode: 301 }, // normalized
  { source: "/product-page/flow-electrolyzer-co2-reduction-peek", destination: "/shop/p/flow-electrolyzer-for-carbon-dioxide-reduction-peek-body", statusCode: 301 }, // verified
  { source: "/product-page/flow-electrolyzer-co2-reduction-ptfe", destination: "/shop/p/flow-electrolyzer-for-carbon-dioxide-reduction-ptfe-body", statusCode: 301 }, // verified
  { source: "/product-page/fumion-dispersion-fumion-faa-3-solut-10", destination: "/shop/p/fumion-faa-3-solut-10-anion-exchange-ionomer-dispersion", statusCode: 301 }, // verified
  { source: "/product-page/gas-diffusion-layer-gdl-carbon-paper", destination: "/shop/p/gas-diffusion-layer-gdl-carbon-paper-for-co2-electrolysis-flow-cell", statusCode: 301 }, // verified
  { source: "/product-page/gas-sampling-bag-1-l-pvdf-film-ptfe-valve", destination: "/shop/p/gas-sampling-bag-1-litre-with-ptfe-valve", statusCode: 301 }, // verified
  { source: "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-φ3mm", destination: "/shop/p/glassy-carbon-electrode-straight-type-ptfe-rod", statusCode: 301 }, // spec-match
  { source: "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-%CF%863mm", destination: "/shop/p/glassy-carbon-electrode-straight-type-ptfe-rod", statusCode: 301 }, // spec-match
  { source: "/product-page/gold-disk-electrode-straight-type-ptcfe-rod-φ2mm", destination: "/shop/p/detachable-gold-disk-electrode-2-mm", statusCode: 301 }, // verified
  { source: "/product-page/gold-disk-electrode-straight-type-ptcfe-rod-%CF%862mm", destination: "/shop/p/detachable-gold-disk-electrode-2-mm", statusCode: 301 }, // verified
  { source: "/product-page/gold-disk-electrode-straight-type-ptfe-rod-φ2mm", destination: "/shop/p/detachable-gold-disk-electrode-2-mm-auds", statusCode: 301 }, // spec-match
  { source: "/product-page/gold-disk-electrode-straight-type-ptfe-rod-%CF%862mm", destination: "/shop/p/detachable-gold-disk-electrode-2-mm-auds", statusCode: 301 }, // spec-match
  { source: "/product-page/gold-wire-ring-counter-electrode-φ0-5-100mm", destination: "/shop/p/gold-wire-ring-counter-electrode-0-5-100mm", statusCode: 301 }, // normalized
  { source: "/product-page/gold-wire-ring-counter-electrode-%CF%860-5-100mm", destination: "/shop/p/gold-wire-ring-counter-electrode-0-5-100mm", statusCode: 301 }, // normalized
  { source: "/product-page/graphite-felt-electrode-for-electrochemical-applications-200x200x3mm", destination: "/shop/p/graphite-felt-electrode-200-200-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/graphite-plate-counter-electrode-10-10mm-thickness-3mm", destination: "/shop/p/graphite-counter-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-φ6-120mm", destination: "/shop/p/graphite-rod-counter-electrode-6-120mm", statusCode: 301 }, // normalized
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-120mm", destination: "/shop/p/graphite-rod-counter-electrode-6-120mm", statusCode: 301 }, // normalized
  { source: "/product-page/graphite-rod-counter-electrode-φ6-60mm", destination: "/shop/p/graphite-rod-counter-electrode-6-60mm", statusCode: 301 }, // normalized
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-60mm", destination: "/shop/p/graphite-rod-counter-electrode-6-60mm", statusCode: 301 }, // normalized
  { source: "/product-page/graphite-rod-counter-electrode-φ6-80mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/graphite-rod-counter-electrode-%CF%866-80mm", destination: "/shop/p/graphite-rod-counter-electrode-6-80-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/h-cell-electrochemical-cell", destination: "/shop/p/h-cell-electrochemical-cell", statusCode: 301 }, // exact
  { source: "/product-page/high-purity-zinc-sheet", destination: "/shop/p/high-purity-zinc-sheet", statusCode: 301 }, // exact
  { source: "/product-page/high-temperature-pem-aem-electrolyzer-hardware", destination: "/shop/p/high-temperature-pem-aem-electrolyzer-hardware", statusCode: 301 }, // exact
  { source: "/product-page/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-press-mach", destination: "/shop/p/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p", statusCode: 301 }, // truncated
  { source: "/product-page/hydraulic-hot-press-pem-fuel-cell-mea", destination: "/shop/p/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p", statusCode: 301 }, // verified
  { source: "/product-page/hydraulic-pressing-machine", destination: "/shop/p/hydraulic-pressing-machine", statusCode: 301 }, // exact
  { source: "/product-page/in-situ-raman-electrochemical-cell-for-operando-raman-spectroscopy", destination: "/shop/p/in-situ-raman-electrochemical-cell-for-operando-raman-spectroscopy", statusCode: 301 }, // exact
  { source: "/product-page/intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v", destination: "/shop/p/intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v", statusCode: 301 }, // exact
  { source: "/product-page/kamoer-kcp-x-mini-peristaltic-pump-24v", destination: "/shop/p/compact-peristaltic-pump-knob-control-65-ml-min", statusCode: 301 }, // verified
  { source: "/product-page/kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad", destination: "/shop/p/compact-peristaltic-pump-knob-control-65-ml-min", statusCode: 301 }, // verified
  { source: "/product-page/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-flow-rate-17-50-ml-min", destination: "/shop/p/compact-peristaltic-pump-knob-control-41-5-ml-min", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-%CF%863mm", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-φ3mm-1", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-%CF%863mm-1", destination: "/shop/p/l-shaped-glassy-carbon-disk-working-electrode-3-mm", statusCode: 301 }, // verified
  { source: "/product-page/lengthened-ptfe-replaceable-platinum-electrode-holder-φ6-100mm", destination: "/shop/p/lengthened-ptfe-replaceable-platinum-electrode-holder-6-100mm", statusCode: 301 }, // normalized
  { source: "/product-page/lengthened-ptfe-replaceable-platinum-electrode-holder-%CF%866-100mm", destination: "/shop/p/lengthened-ptfe-replaceable-platinum-electrode-holder-6-100mm", statusCode: 301 }, // normalized
  { source: "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-φ6-95mm", destination: "/shop/p/lengthened-saturated-calomel-electrode-hg-hg2cl2-6-95mm", statusCode: 301 }, // normalized
  { source: "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-%CF%866-95mm", destination: "/shop/p/lengthened-saturated-calomel-electrode-hg-hg2cl2-6-95mm", statusCode: 301 }, // normalized
  { source: "/product-page/manganese-dioxide-nanoparticles", destination: "/shop/p/manganese-dioxide-nanoparticles", statusCode: 301 }, // exact
  { source: "/product-page/mercurous-sulfate-reference-electrode-hg-hg2so4", destination: "/shop/p/mercurous-sulfate-reference-electrode-hg-hg2so4", statusCode: 301 }, // exact
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-φ6-70mm", destination: "/shop/p/hg-hgo-reference-electrode-6-70-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%866-70mm", destination: "/shop/p/hg-hgo-reference-electrode-6-70-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-φ4-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-%CF%864-60mm", destination: "/shop/p/mercury-oxide-reference-electrode-hg-hgo", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-φ6-60mm", destination: "/shop/p/hg-hgo-reference-electrode-6-60-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-%CF%866-60mm", destination: "/shop/p/hg-hgo-reference-electrode-6-60-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/metal-air-battery-test-cell", destination: "/shop/p/metal-air-battery-reactor", statusCode: 301 }, // verified
  { source: "/product-page/microbial-fuel-cell-mfc-dual-chamber-reactor", destination: "/shop/p/microbial-fuel-cell-mfc-reactor", statusCode: 301 }, // verified
  { source: "/product-page/microbial-fuel-cell-stack", destination: "/shop/p/microbial-fuel-cell-stack-ma-mfc-5", statusCode: 301 }, // verified
  { source: "/product-page/nafion-117-membrane", destination: "/shop/p/pfsa-proton-exchange-membrane-300-mm-x-300-mm", statusCode: 301 }, // verified
  { source: "/product-page/nickel-fiber-felt-electrode-material-porous-ni-felt-hydrogen-fuel-cell-diffusion", destination: "/shop/p/nickel-fiber-felt-electrode-10-10-cm", statusCode: 301 }, // verified
  { source: "/product-page/nickel-foam-electrode-110-ppi-200x300mm", destination: "/shop/p/nickel-foam-electrode-200-300-1-5-mm", statusCode: 301 }, // verified
  { source: "/product-page/noble-metal-plate-platinum-20-20-0-1mm", destination: "/shop/p/noble-metal-plate-platinum-20-20-0-1mm", statusCode: 301 }, // exact
  { source: "/product-page/noble-metal-plate-platinum-30-30-0-1mm", destination: "/shop/p/noble-metal-plate-platinum-30-30-0-1mm", statusCode: 301 }, // exact
  { source: "/product-page/non-aqueous-silver-silver-ion-reference-electrode-ag-ag-glass-rod", destination: "/shop/p/non-aqueous-silver-silver-ion-reference-electrode-ag-ag", statusCode: 301 }, // verified
  { source: "/product-page/peek-co-rr-gas-diffusion-flow-cell-20-20-mm-co-electrochemical-flow-cell", destination: "/shop/p/peek-co2rr-gas-diffusion-flow-cell-20-20-mm-co2-electrochemical-flow-cell", statusCode: 301 }, // verified
  { source: "/product-page/peek-replaceable-glassy-carbon-electrode-holder-slit-1mm", destination: "/shop/p/peek-replaceable-glassy-carbon-electrode-holder-slit-1mm", statusCode: 301 }, // exact
  { source: "/product-page/peek-replaceable-glassy-carbon-electrode-holder-slit-3mm", destination: "/shop/p/peek-replaceable-glassy-carbon-electrode-holder-slit-3mm", statusCode: 301 }, // exact
  { source: "/product-page/peek-replaceable-glassy-carbon-electrode-holder-slit-8mm", destination: "/shop/p/peek-replaceable-glassy-carbon-electrode-holder-slit-8mm", statusCode: 301 }, // exact
  { source: "/product-page/peek-replaceable-l-shaped-glassy-carbon-electrode-holder-slit-3mm", destination: "/shop/p/peek-replaceable-l-shaped-glassy-carbon-electrode-holder-slit-3mm", statusCode: 301 }, // exact
  { source: "/product-page/pem-hydrogen-electrolyzer-cell-60-ml-min", destination: "/shop/p/pem-hydrogen-electrolyzer-60-ml-min", statusCode: 301 }, // verified
  { source: "/product-page/perfluorosulfonic-acid-pfsa-resin-dispersion-5wt-solution", destination: "/shop/p/perfluorosulfonic-acid-pfsa-resin-dispersion-5wt-solution", statusCode: 301 }, // exact
  { source: "/product-page/peristaltic-pump", destination: "/shop/p/peristaltic-pump", statusCode: 301 }, // exact
  { source: "/product-page/pfsa-proton-exchange-membrane-n115-100x100-mm", destination: "/shop/p/perfluorosulfonic-acid-pfsa-proton-exchange-membrane-n115-pem", statusCode: 301 }, // verified
  { source: "/product-page/photocatalyst-panel-reactor-for-hydrogen-generation", destination: "/shop/p/photocatalytic-water-splitting-panel-reactors-app-400", statusCode: 301 }, // verified
  { source: "/product-page/photovoltaic-biased-photoelectrochemical-cell", destination: "/shop/p/photovoltaic-pv-biased-photoelectrochemical-cell-pec", statusCode: 301 }, // verified
  { source: "/product-page/piperion-aem-20-microns-self-supporting", destination: "/shop/p/piperion-aem", statusCode: 301 }, // verified
  { source: "/product-page/piperion-anion-exchange-dispersion-5-wt-20-ml", destination: "/shop/p/piperion-anion-exchange-ionomer-dispersion-5-wt-20-ml", statusCode: 301 }, // verified
  { source: "/product-page/platinum-counter-electrode-with-spring-shaped-pt-wire-electrode-sheath", destination: "/shop/p/platinum-spiral-counter-electrode", statusCode: 301 }, // verified
  { source: "/product-page/platinum-disk-electrode-straight-type-ptfe-rod-φ2mm", destination: "/shop/p/detachable-platinum-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-disk-electrode-straight-type-ptfe-rod-%CF%862mm", destination: "/shop/p/detachable-platinum-disk-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-10-10mm", destination: "/shop/p/platinum-mesh-electrode-without-diagonal-reinforcement-10-10mm", statusCode: 301 }, // exact
  { source: "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-20-20mm", destination: "/shop/p/platinum-mesh-electrode-without-diagonal-reinforcement-20-20mm", statusCode: 301 }, // exact
  { source: "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-30-30mm", destination: "/shop/p/platinum-mesh-counter-electrode-30-30-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-sheet-counter-electrode-10-10-0-1mm", destination: "/shop/p/platinum-sheet-counter-electrode-10-10-0-1mm", statusCode: 301 }, // exact
  { source: "/product-page/platinum-sheet-counter-electrode-15-20-0-1mm", destination: "/shop/p/platinum-sheet-counter-electrode-15-20-0-1mm", statusCode: 301 }, // exact
  { source: "/product-page/platinum-sheet-counter-electrode-20-20-0-1mm", destination: "/shop/p/platinum-sheet-counter-electrode-20-20-0-1mm", statusCode: 301 }, // exact
  { source: "/product-page/platinum-sheet-counter-electrode-30-30-0-1mm", destination: "/shop/p/platinum-sheet-counter-electrode-30-30-0-1mm", statusCode: 301 }, // exact
  { source: "/product-page/platinum-wire-counter-electrode-φ0-5-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-0-5-37mm-peek-rod", statusCode: 301 }, // normalized
  { source: "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-0-5-37mm-peek-rod", statusCode: 301 }, // normalized
  { source: "/product-page/platinum-wire-counter-electrode-φ0-5-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-0-5-37mm-ptfe-rod", statusCode: 301 }, // normalized
  { source: "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-0-5-37mm-ptfe-rod", statusCode: 301 }, // normalized
  { source: "/product-page/platinum-wire-counter-electrode-φ1-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm-ptwk", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-peek-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm-ptwk", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-φ1-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-ptfe-rod", destination: "/shop/p/platinum-wire-counter-electrode-1-37-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-ring-counter-electrode-φ0-5-100mm", destination: "/shop/p/platinum-wire-ring-counter-electrode-0-5-100mm", statusCode: 301 }, // normalized
  { source: "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-100mm", destination: "/shop/p/platinum-wire-ring-counter-electrode-0-5-100mm", statusCode: 301 }, // normalized
  { source: "/product-page/platinum-wire-ring-counter-electrode-φ0-5-230mm", destination: "/shop/p/platinum-ring-counter-electrode-0-5-230-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-230mm", destination: "/shop/p/platinum-ring-counter-electrode-0-5-230-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/ptfe-40ml-water-splitting-electrochemical-reactor-three-electrode-system", destination: "/shop/p/ptfe-water-splitting-reactor-40-ml-three-electrode", statusCode: 301 }, // verified
  { source: "/product-page/ptfe-electrode-holder", destination: "/shop/p/ptfe-replaceable-electrode-holder-mpg-10", statusCode: 301 }, // verified
  { source: "/product-page/ptfe-photoelectrochemical-cell-for-three-electrode-quantum-efficiency-ipce", destination: "/shop/p/ptfe-photoelectrochemical-cell-for-three-electrode-quantum-efficiency-ipce", statusCode: 301 }, // exact
  { source: "/product-page/ptfe-replaceable-copper-electrode-holder", destination: "/shop/p/ptfe-replaceable-copper-electrode-holder", statusCode: 301 }, // exact
  { source: "/product-page/ptfe-replaceable-electrode-holder-with-stainless-steel-crocodile-clip", destination: "/shop/p/ptfe-replaceable-electrode-holder-with-stainless-steel-crocodile-clip", statusCode: 301 }, // exact
  { source: "/product-page/ptfe-replaceable-platinum-electrode-holder", destination: "/shop/p/ptfe-replaceable-platinum-electrode-holder", statusCode: 301 }, // exact
  { source: "/product-page/ptfe-replaceable-titanium-electrode-holder", destination: "/shop/p/ptfe-replaceable-titanium-electrode-holder", statusCode: 301 }, // exact
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-φ5-75-50mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%865-75-50mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-φ6-70mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%866-70mm", destination: "/shop/p/saturated-calomel-electrode-hg-hg2cl2", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-peek-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ2-4-60mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-2-4-60mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-4-60mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-2-4-60mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ2-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-2-50mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-2-50mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ4-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-4-50mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-50mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-4-50mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ4-90mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-4-90mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-90mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-4-90mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6-140mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-140mm-glass-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-140-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6-70mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-6-70mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-70mm-glass-rod", destination: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-6-70mm-glass-rod", statusCode: 301 }, // normalized
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-φ6mm-ptfe-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866mm-ptfe-rod", destination: "/shop/p/ag-agcl-reference-electrode-6-mm", statusCode: 301 }, // spec-match
  { source: "/product-page/swagelok-battery-test-fixture", destination: "/shop/p/swagelok-battery-test-fixture", statusCode: 301 }, // exact
  { source: "/product-page/temperature-controlling-unit", destination: "/shop/p/temperature-controlling-unit", statusCode: 301 }, // exact
  { source: "/product-page/titanium-felt-electrode-porous-ti-felt", destination: "/shop/p/titanium-felt-electrode", statusCode: 301 }, // verified
  { source: "/product-page/titanium-felt-electrode-porous-ti-felt-for-electrochemical-applications-fuel", destination: "/shop/p/titanium-felt-electrode", statusCode: 301 }, // carried
  { source: "/product-page/transparent-carbon-dioxide-gas-diffusion-flow-cell", destination: "/shop/p/transparent-carbon-dioxide-gas-diffusion-flow-cell", statusCode: 301 }, // exact
  { source: "/product-page/transparent-water-splitting-reactor", destination: "/shop/p/transparent-water-splitting-reactor", statusCode: 301 }, // exact
  { source: "/product-page/triboelectric-measurement-setup", destination: "/shop/p/triboelectric-measurement-setup", statusCode: 301 }, // exact
  { source: "/product-page/vanadium-flow-cell-reactor", destination: "/shop/p/vanadium-flow-cell-reactor", statusCode: 301 }, // exact
  { source: "/product-page/water-splitting-reactor", destination: "/shop/p/ewb-water-splitting-reactor", statusCode: 301 }, // verified
  { source: "/product-page/water-splitting-reactor-ewf-zero-gap-electrolyzer-acrylic-transparent-model", destination: "/shop/p/ewf-transparent-flow-electrolyzer-zero-gap", statusCode: 301 }, // verified
  { source: "/product-page/zero-gap-electrolyzer-for-carbon-dioxide-reduction", destination: "/shop/p/zero-gap-electrolyzer-for-carbon-dioxide-reduction", statusCode: 301 }, // exact

  // ---- Renamed .com product slugs ---------------------------------------
  // Renamed outside the CMS hook, so product-slug-redirects never recorded them.
  // If a product ever takes one of these slugs again, delete its line first.
  { source: "/shop/p/intelligent-peristaltic-pump-dual-channel-dc-24v", destination: "/shop/p/intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v", statusCode: 301 },
  { source: "/shop/p/kamoer-kcp-x-mini-peristaltic-pump-24v-19-65-ml-min-with-control", destination: "/shop/p/compact-peristaltic-pump-knob-control-65-ml-min", statusCode: 301 },
  { source: "/shop/p/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-17-50-ml-min", destination: "/shop/p/compact-peristaltic-pump-knob-control-41-5-ml-min", statusCode: 301 },

  // ---- Catch-alls (MUST stay last: first match wins) --------------------
  // 0 historical legacy product(s) have no equivalent we can prove.
  { source: "/product-page/:slug", destination: "/shop/all", statusCode: 301 },
  { source: "/post/:slug", destination: "/blog", statusCode: 301 },
];

// Every URL metnmat.in has served (181): pages, products current and
// historical, and posts. Once metnmat.in points at this host it serves this list
// as its own sitemap.xml (legacy-domain.mjs), so Google recrawls each old URL
// and finds its redirect instead of waiting to stumble on it.
/** @type {string[]} */
export const legacyInPaths = [
  "/",
  "/about",
  "/applied-researchandconsultancy",
  "/blank",
  "/blank-1",
  "/blank-2",
  "/blank-3",
  "/blank-4",
  "/blank-5",
  "/blog",
  "/case-studies",
  "/contact",
  "/gift-card",
  "/home-1",
  "/home-2",
  "/material-processing-facilities",
  "/materials-testing",
  "/members",
  "/my-addresses",
  "/our-research",
  "/our-team",
  "/post/advances-in-polymer-based-new-materials-revolutionizing-industries",
  "/post/biomimetic-materials-nature-inspired-innovations",
  "/post/challenges-and-advances-in-microstructure-analysis-techniques-discovering-a-tiny-world",
  "/post/defect-and-microstructure-analysis-by-diffraction-unveiling-materials-at-the-atomic-level",
  "/post/emerging-trends-and-innovations-in-new-materials-shaping-the-future-of-technology-and-sustainability",
  "/post/exploring-the-world-of-high-temperature-alloys-a-comprehensive-guide",
  "/post/future-trends-in-microstructure-analysis-advancing-technology-innovations",
  "/post/how-metallurgical-techniques-improve-material-performance",
  "/post/how-research-and-development-drives-sustainable-development",
  "/post/introduction-to-metallurgy-exploring-the-science-of-metals-metnmat-research-and-innovation",
  "/post/key-elements-of-an-effective-research-and-development-process",
  "/post/metal-manufacturing-as-the-smart-specialization-of-the-regions",
  "/post/metallurgy-and-material-selection-for-extreme-environments-exploring-high-performance-materials",
  "/post/microstructural-analysis-empowers-researchers-to-design-advanced-materials-enhance-quality-control",
  "/post/microstructure-analysis-in-electronics-and-microelectronics-understanding-material-properties",
  "/post/modern-technologies-and-innovations-in-metallurgy-shaping-industries-with-cutting-edge-metal-advanc",
  "/post/new-materials-in-aerospace-engineering-lightweight-and-high-performance-solutions",
  "/post/progress-in-research-and-development-of-electron-beam-technology-in-metallurgy-refining-field",
  "/post/tailored-solutions-for-metallurgy-and-materials-industries-metnmat-research-and-innovation",
  "/post/the-basics-of-metals-and-alloys-understanding-composition-properties-and-applications",
  "/post/the-future-of-new-materials-in-metallurgy-advancements-and-applications",
  "/post/the-future-of-research-and-development-trends-and-predictions",
  "/post/the-impact-of-r-d-on-new-materials-from-lab-to-reality",
  "/post/the-importance-of-metallurgical-testing-in-quality-control-and-assurance",
  "/post/the-power-of-alloys-unveiling-their-uses-advantages-a-comprehensive-guide",
  "/post/the-role-of-research-and-development-in-driving-innovation-a-key-to-growth-and-success",
  "/privacy-policy",
  "/process-quality-improvement",
  "/product-benchmarking",
  "/product-page/100-ml-100-ml-h-type-electrochemical-h-cell-dual-chamber-reactor",
  "/product-page/100-ml-water-jacketed-electrochemical-cell-three-electrode",
  "/product-page/30-ml-30-ml-h-type-electrochemical-h-cell-dual-chamber-electrochemical-cell",
  "/product-page/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model-mhp-30",
  "/product-page/400-w-metnmat-fuel-cell-metal-air-battery-testing-device",
  "/product-page/5-cm-pem-fuel-cell-hardware",
  "/product-page/50-ml-single-chamber-electrochemical-cell-glass-reactor",
  "/product-page/5cm2-research-scale-electrolyzer-cell",
  "/product-page/aluminum-sheet",
  "/product-page/anion-exchange-membrane-fumasep-faa-3-50-100x100-mm",
  "/product-page/conducting-carbon-fiber-cloth-ct-200mm-x-200mm",
  "/product-page/copper-foam-200mm-x-300mm",
  "/product-page/detachable-gold-dsic-electrode-straight-type-peek-rod-sem-%CF%863mm",
  "/product-page/detachable-l-shaped-gold-disk-electrode-%CF%864mm",
  "/product-page/detachable-l-shaped-platinum-disk-electrode-%CF%864mm",
  "/product-page/detachable-peek-replaceable-glassy-carbon-electrode-holder",
  "/product-page/detachable-peek-replaceable-platinum-electrode-holder",
  "/product-page/dual-chambered-in-situ-raman-spectroscopy-cell-with-single-light-window",
  "/product-page/electrowinning-system-pp-electrochemical-cell-with-ss316-titanium-electrodes",
  "/product-page/flow-cell-accessories-mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%864-70",
  "/product-page/flow-electrolyzer-co2-reduction-peek",
  "/product-page/flow-electrolyzer-co2-reduction-ptfe",
  "/product-page/fumion-dispersion-fumion-faa-3-solut-10",
  "/product-page/gas-diffusion-layer-gdl-carbon-paper",
  "/product-page/gas-sampling-bag-1-l-pvdf-film-ptfe-valve",
  "/product-page/glassy-carbon-electrode-straight-type-ptfe-rod-%CF%863mm",
  "/product-page/gold-disk-electrode-straight-type-ptcfe-rod-%CF%862mm",
  "/product-page/gold-disk-electrode-straight-type-ptfe-rod-%CF%862mm",
  "/product-page/gold-wire-ring-counter-electrode-%CF%860-5-100mm",
  "/product-page/graphite-felt-electrode-for-electrochemical-applications-200x200x3mm",
  "/product-page/graphite-plate-counter-electrode-10-10mm-thickness-3mm",
  "/product-page/graphite-rod-counter-electrode-%CF%866-120mm",
  "/product-page/graphite-rod-counter-electrode-%CF%866-60mm",
  "/product-page/graphite-rod-counter-electrode-%CF%866-80mm",
  "/product-page/h-cell-electrochemical-cell",
  "/product-page/high-purity-zinc-sheet",
  "/product-page/high-temperature-pem-aem-electrolyzer-hardware",
  "/product-page/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-press-mach",
  "/product-page/hydraulic-hot-press-pem-fuel-cell-mea",
  "/product-page/hydraulic-pressing-machine",
  "/product-page/in-situ-raman-electrochemical-cell-for-operando-raman-spectroscopy",
  "/product-page/intelligent-peristaltic-pump-dual-channel-working-voltage-dc-24v",
  "/product-page/kamoer-kcp-x-mini-peristaltic-pump-24v",
  "/product-page/kamoer-kcp-x-mini-peristaltic-pump-24v-with-control-low-flow-rate-19-65ml-min-ad",
  "/product-page/kamoer-kcp2-kxf-s08-peristaltic-lab-pump-12v-dc-flow-rate-17-50-ml-min",
  "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-%CF%863mm",
  "/product-page/l-shaped-glassy-carbon-electrode-ptfe-rod-%CF%863mm-1",
  "/product-page/lengthened-ptfe-replaceable-platinum-electrode-holder-%CF%866-100mm",
  "/product-page/lengthened-saturated-calomel-electrode-hg-hg2cl2-%CF%866-95mm",
  "/product-page/manganese-dioxide-nanoparticles",
  "/product-page/mercurous-sulfate-reference-electrode-hg-hg2so4",
  "/product-page/mercury-oxide-reference-electrode-hg-hgo-galss-rod-%CF%866-70mm",
  "/product-page/mercury-oxide-reference-electrode-hg-hgo-peek-rod-%CF%864-60mm",
  "/product-page/mercury-oxide-reference-electrode-hg-hgo-ptfe-rod-%CF%866-60mm",
  "/product-page/metal-air-battery-test-cell",
  "/product-page/microbial-fuel-cell-mfc-dual-chamber-reactor",
  "/product-page/microbial-fuel-cell-stack",
  "/product-page/nafion-117-membrane",
  "/product-page/nickel-fiber-felt-electrode-material-porous-ni-felt-hydrogen-fuel-cell-diffusion",
  "/product-page/nickel-foam-electrode-110-ppi-200x300mm",
  "/product-page/noble-metal-plate-platinum-20-20-0-1mm",
  "/product-page/noble-metal-plate-platinum-30-30-0-1mm",
  "/product-page/non-aqueous-silver-silver-ion-reference-electrode-ag-ag-glass-rod",
  "/product-page/peek-co-rr-gas-diffusion-flow-cell-20-20-mm-co-electrochemical-flow-cell",
  "/product-page/peek-replaceable-glassy-carbon-electrode-holder-slit-1mm",
  "/product-page/peek-replaceable-glassy-carbon-electrode-holder-slit-3mm",
  "/product-page/peek-replaceable-glassy-carbon-electrode-holder-slit-8mm",
  "/product-page/peek-replaceable-l-shaped-glassy-carbon-electrode-holder-slit-3mm",
  "/product-page/pem-hydrogen-electrolyzer-cell-60-ml-min",
  "/product-page/perfluorosulfonic-acid-pfsa-resin-dispersion-5wt-solution",
  "/product-page/peristaltic-pump",
  "/product-page/pfsa-proton-exchange-membrane-n115-100x100-mm",
  "/product-page/photocatalyst-panel-reactor-for-hydrogen-generation",
  "/product-page/photovoltaic-biased-photoelectrochemical-cell",
  "/product-page/piperion-aem-20-microns-self-supporting",
  "/product-page/piperion-anion-exchange-dispersion-5-wt-20-ml",
  "/product-page/platinum-counter-electrode-with-spring-shaped-pt-wire-electrode-sheath",
  "/product-page/platinum-disk-electrode-straight-type-ptfe-rod-%CF%862mm",
  "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-10-10mm",
  "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-20-20mm",
  "/product-page/platinum-mesh-electrode-without-diagonal-reinforcement-30-30mm",
  "/product-page/platinum-sheet-counter-electrode-10-10-0-1mm",
  "/product-page/platinum-sheet-counter-electrode-15-20-0-1mm",
  "/product-page/platinum-sheet-counter-electrode-20-20-0-1mm",
  "/product-page/platinum-sheet-counter-electrode-30-30-0-1mm",
  "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-peek-rod",
  "/product-page/platinum-wire-counter-electrode-%CF%860-5-37mm-ptfe-rod",
  "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-peek-rod",
  "/product-page/platinum-wire-counter-electrode-%CF%861-37mm-ptfe-rod",
  "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-100mm",
  "/product-page/platinum-wire-ring-counter-electrode-%CF%860-5-230mm",
  "/product-page/ptfe-40ml-water-splitting-electrochemical-reactor-three-electrode-system",
  "/product-page/ptfe-electrode-holder",
  "/product-page/ptfe-photoelectrochemical-cell-for-three-electrode-quantum-efficiency-ipce",
  "/product-page/ptfe-replaceable-copper-electrode-holder",
  "/product-page/ptfe-replaceable-electrode-holder-with-stainless-steel-crocodile-clip",
  "/product-page/ptfe-replaceable-platinum-electrode-holder",
  "/product-page/ptfe-replaceable-titanium-electrode-holder",
  "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%865-75-50mm",
  "/product-page/saturated-calomel-electrode-hg-hg2cl2-%CF%866-70mm",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-4-60mm-glass-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%862-50mm-glass-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-50mm-glass-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%864-90mm-glass-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-140mm-glass-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866-70mm-glass-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-%CF%866mm-ptfe-rod",
  "/product-page/silver-silver-chloride-ag-agcl-reference-electrode-peek-rod",
  "/product-page/swagelok-battery-test-fixture",
  "/product-page/temperature-controlling-unit",
  "/product-page/titanium-felt-electrode-porous-ti-felt",
  "/product-page/titanium-felt-electrode-porous-ti-felt-for-electrochemical-applications-fuel",
  "/product-page/transparent-carbon-dioxide-gas-diffusion-flow-cell",
  "/product-page/transparent-water-splitting-reactor",
  "/product-page/triboelectric-measurement-setup",
  "/product-page/vanadium-flow-cell-reactor",
  "/product-page/water-splitting-reactor",
  "/product-page/water-splitting-reactor-ewf-zero-gap-electrolyzer-acrylic-transparent-model",
  "/product-page/zero-gap-electrolyzer-for-carbon-dioxide-reduction",
  "/product-process-development",
  "/productinfo",
  "/projects",
  "/projects-1",
  "/range-of-analysis",
  "/request-a-quote",
  "/services",
  "/services-1",
  "/shipping",
  "/shop",
  "/shop-1",
  "/thank-you"
];
