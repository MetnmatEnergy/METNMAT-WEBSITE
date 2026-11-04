/**
 * What people actually type for each product, as opposed to what the catalogue
 * calls it. Nobody searches "Hg/HgO reference electrode Ø4 × 60 mm PEEK rod":
 * they type "hgo reference electrode" or "mercury oxide electrode". Terms come
 * from Google India autocomplete and Search Console (read 2026-11-04), so add to
 * them from the same sources, not from guesses.
 *
 * Every entry must be a true name for the product. N117, N115 and N212 are PFSA
 * membranes and are never given the name Nafion. Rules are tried in order and
 * the first match wins, so a specific rule must sit above a general one: a
 * "Platinum Wire Ring" is a ring before it is a wire.
 *
 * The first term is the plain name of the product, used in the price FAQ.
 */
type Rule = { when: RegExp; category?: string; terms: string[] };

const RULES: Rule[] = [
  // Reference electrodes
  { when: /Hg\/HgO|mercury oxide/i, terms: ["Hg/HgO reference electrode", "HgO reference electrode", "Hg/HgO electrode", "mercury oxide reference electrode", "mercury mercuric oxide electrode"] },
  { when: /Ag\/Ag\+|non-aqueous/i, terms: ["Ag/Ag+ reference electrode", "non-aqueous reference electrode", "silver ion reference electrode"] },
  { when: /Ag\/AgCl/, terms: ["Ag/AgCl reference electrode", "Ag/AgCl electrode", "AgCl reference electrode", "silver chloride electrode", "silver silver chloride electrode"] },
  { when: /calomel/i, terms: ["saturated calomel electrode", "calomel electrode", "SCE electrode", "SCE reference electrode", "Hg/Hg2Cl2 electrode"] },
  { when: /Hg2SO4|mercurous sulfate/i, terms: ["mercurous sulfate reference electrode", "mercury sulfate electrode", "Hg/Hg2SO4 electrode", "MSE reference electrode"] },

  // Holders come before the metals, because their names contain "platinum" too.
  { when: /glassy carbon/i, category: "electrode-holders", terms: ["glassy carbon electrode holder", "GCE electrode holder", "PEEK electrode holder", "working electrode holder"] },
  { when: /crocodile/i, category: "electrode-holders", terms: ["crocodile clip electrode holder", "alligator clip electrode holder", "clip electrode holder", "Teflon electrode holder", "PTFE electrode holder"] },
  { when: /platinum/i, category: "electrode-holders", terms: ["platinum electrode holder", "Pt electrode holder", "PTFE electrode holder", "Teflon electrode holder", "working electrode holder"] },
  { when: /titanium/i, category: "electrode-holders", terms: ["titanium electrode holder", "PTFE electrode holder", "Teflon electrode holder", "working electrode holder"] },
  { when: /copper/i, category: "electrode-holders", terms: ["copper electrode holder", "PTFE electrode holder", "Teflon electrode holder", "working electrode holder"] },
  { when: /./, category: "electrode-holders", terms: ["electrode holder", "PTFE electrode holder", "Teflon electrode holder", "working electrode holder", "replaceable electrode holder"] },

  // Metal and carbon electrodes
  { when: /gold wire|gold.*ring/i, terms: ["gold wire electrode", "gold counter electrode", "gold ring electrode", "Au wire electrode"] },
  { when: /gold/i, terms: ["gold disk electrode", "gold electrode", "gold working electrode", "Au disk electrode"] },
  { when: /platinum disk/i, terms: ["platinum disk electrode", "platinum working electrode", "Pt disk electrode", "platinum electrode"] },
  { when: /platinum.*ring/i, terms: ["platinum ring electrode", "platinum wire ring electrode", "platinum counter electrode", "Pt ring electrode"] },
  { when: /platinum.*spiral/i, terms: ["platinum spiral electrode", "platinum coil electrode", "platinum counter electrode", "Pt spiral electrode"] },
  { when: /platinum.*mesh/i, terms: ["platinum mesh electrode", "Pt mesh electrode", "platinum mesh counter electrode", "platinum gauze electrode"] },
  { when: /platinum wire/i, terms: ["platinum wire electrode", "Pt wire electrode", "platinum wire counter electrode", "platinum auxiliary electrode"] },
  { when: /platinum sheet|plate platinum/i, terms: ["platinum sheet electrode", "platinum plate electrode", "platinum foil electrode", "Pt foil electrode", "platinum counter electrode"] },
  { when: /platinum/i, terms: ["platinum counter electrode", "platinum electrode", "Pt counter electrode", "platinum auxiliary electrode"] },
  { when: /graphite rod/i, terms: ["graphite rod electrode", "graphite counter electrode", "carbon rod electrode", "graphite carbon rod electrode"] },
  { when: /graphite plate/i, terms: ["graphite plate electrode", "graphite electrode", "carbon plate electrode", "graphite counter electrode"] },
  { when: /glassy carbon/i, terms: ["glassy carbon electrode", "GCE electrode", "glassy carbon working electrode", "glassy carbon disk electrode"] },
  { when: /titanium felt/i, terms: ["titanium felt", "Ti felt", "titanium felt electrode", "porous titanium felt"] },

  // Porous materials
  { when: /nickel fi(b|br)er|nickel felt/i, terms: ["nickel felt", "nickel fiber felt", "nickel felt electrode", "Ni felt"] },
  { when: /nickel foam/i, terms: ["nickel foam", "Ni foam", "nickel foam electrode", "nickel foam sheet"] },
  { when: /graphite felt/i, terms: ["graphite felt", "graphite felt electrode", "carbon felt electrode"] },
  { when: /carbon (fiber )?cloth/i, terms: ["carbon cloth", "carbon cloth electrode", "carbon fiber cloth", "conductive carbon cloth"] },
  { when: /copper foam/i, terms: ["copper foam", "copper foam sheet", "Cu foam"] },
  { when: /gas diffusion layer/i, terms: ["carbon paper", "GDL carbon paper", "gas diffusion layer", "GDL for electrolyzer"] },

  // Cells and reactors
  { when: /raman/i, terms: ["in situ Raman electrochemical cell", "Raman electrochemical cell", "operando Raman cell", "spectroelectrochemical Raman cell"] },
  { when: /zero-?gap.*carbon dioxide/i, terms: ["zero gap CO2 electrolyzer", "CO2 electrolyzer cell", "CO2 electrolyzer", "MEA CO2 electrolyzer"] },
  { when: /carbon dioxide|co₂|co2/i, terms: ["CO2 reduction flow cell", "CO2 electrolyzer", "gas diffusion electrode flow cell", "CO2RR flow cell", "CO2 electrolyzer cell"] },
  { when: /zero.?gap/i, terms: ["zero gap electrolyzer", "zero gap electrolyser", "zero gap electrolysis cell", "flow electrolyzer"] },
  { when: /h-?cell|h-type/i, terms: ["H-cell", "H type electrochemical cell", "H type electrolytic cell", "two compartment electrochemical cell", "dual chamber electrochemical cell"] },
  { when: /water-jacketed/i, terms: ["water jacketed electrochemical cell", "water jacketed glass cell", "jacketed electrochemical cell", "three electrode cell"] },
  { when: /single-chamber/i, terms: ["electrochemical cell", "three electrode cell", "glass electrochemical cell", "single compartment electrochemical cell"] },
  { when: /electrowinning/i, terms: ["electrowinning cell", "electrowinning system", "lab electrowinning setup"] },
  { when: /pem hydrogen/i, terms: ["PEM electrolyzer", "PEM electrolyser", "hydrogen electrolyzer", "PEM water electrolyzer"] },
  { when: /pem\/aem/i, terms: ["PEM electrolyzer hardware", "AEM electrolyzer cell", "high temperature electrolyzer", "PEM electrolyzer"] },
  { when: /research-scale electrolyzer/i, terms: ["electrolyzer test cell", "lab electrolyzer cell", "PEM electrolyzer cell", "AEM electrolyzer cell"] },
  { when: /photo-ewb/i, terms: ["photoelectrochemical water splitting cell", "water splitting reactor", "PEC cell for water splitting", "quartz window electrochemical cell"] },
  { when: /water splitting panel|photocatalytic/i, terms: ["photocatalytic reactor", "photocatalytic water splitting reactor", "photocatalyst panel reactor"] },
  { when: /water splitting/i, terms: ["water splitting reactor", "water splitting electrochemical cell", "water electrolysis cell", "HER OER test cell"] },
  { when: /photoelectrochemical/i, terms: ["photoelectrochemical cell", "PEC cell", "PEC cell for water splitting", "photoelectrochemical water splitting cell"] },
  { when: /microbial fuel cell stack/i, terms: ["microbial fuel cell stack", "microbial fuel cell", "MFC stack", "microbial fuel cell kit"] },
  { when: /microbial/i, terms: ["microbial fuel cell", "microbial fuel cell kit", "MFC reactor", "microbial fuel cell reactor"] },
  { when: /pem fuel cell/i, terms: ["PEM fuel cell hardware", "PEM fuel cell kit", "fuel cell test fixture", "single cell fuel cell hardware"] },
  { when: /vanadium/i, terms: ["vanadium redox flow battery cell", "vanadium flow battery test cell", "VRFB cell", "redox flow battery cell"] },
  { when: /swagelok/i, terms: ["Swagelok cell", "Swagelok type cell", "battery test cell", "battery cell test fixture", "Swagelok cell for lithium ion battery"] },
  { when: /metal-air battery reactor/i, terms: ["metal air battery test cell", "metal air battery reactor", "zinc air battery test cell", "air breathing battery cell"] },
  { when: /metal-flow/i, terms: ["flow battery test cell", "flow battery reactor", "redox flow cell", "metal flow battery"] },

  // Membranes and ionomers
  { when: /\bN(117|115|212)\b/, terms: ["PFSA membrane", "proton exchange membrane", "PEM membrane", "perfluorosulfonic acid membrane"] },
  { when: /proton exchange membrane/i, terms: ["PFSA membrane", "proton exchange membrane", "PEM membrane", "perfluorosulfonic acid membrane"] },
  { when: /fumasep.*cation|fs-9100/i, terms: ["cation exchange membrane", "CEM membrane", "Fumasep cation exchange membrane", "Fumasep membrane"] },
  { when: /fumasep fbm|bipolar/i, terms: ["bipolar membrane", "Fumasep FBM", "BPM membrane", "bipolar membrane for electrodialysis"] },
  { when: /fumasep/i, terms: ["Fumasep membrane", "Fumasep anion exchange membrane", "AEM membrane", "anion exchange membrane"] },
  { when: /sustainion/i, terms: ["Sustainion membrane", "Sustainion X37", "AEM membrane", "anion exchange membrane for CO2 electrolysis"] },
  { when: /piperion.*(ionomer|dispersion)/i, terms: ["PiperION ionomer", "anion exchange ionomer", "AEM ionomer", "PiperION dispersion"] },
  { when: /piperion/i, terms: ["PiperION membrane", "PiperION AEM", "AEM membrane", "anion exchange membrane"] },
  { when: /amberlite|aem/i, terms: ["anion exchange membrane", "AEM membrane", "PVP anion exchange membrane"] },
  { when: /fumion/i, terms: ["Fumion ionomer", "FAA-3 ionomer", "anion exchange ionomer", "AEM ionomer"] },
  { when: /pfsa.*(dispersion|resin)/i, terms: ["PFSA dispersion", "PFSA ionomer", "perfluorosulfonic acid solution", "ionomer solution"] },

  // Pumps
  { when: /kamoer.*24 ?v/i, terms: ["Kamoer pump", "Kamoer peristaltic pump", "Kamoer pump 24V", "24V peristaltic pump"] },
  { when: /kamoer/i, terms: ["Kamoer pump", "Kamoer peristaltic pump", "Kamoer pump 12V", "12V peristaltic pump"] },
  { when: /wi-?fi/i, terms: ["Wi-Fi peristaltic pump", "smart peristaltic pump", "touchscreen peristaltic pump", "lab peristaltic pump"] },
  { when: /dispensing/i, terms: ["dispensing peristaltic pump", "peristaltic dosing pump", "dosing pump", "lab peristaltic pump"] },
  { when: /dual|mbt350d|kpk200/i, terms: ["dual channel peristaltic pump", "two channel peristaltic pump", "lab peristaltic pump", "peristaltic pump"] },
  { when: /peristaltic/i, terms: ["peristaltic pump", "lab peristaltic pump", "laboratory peristaltic pump", "small peristaltic pump"] },

  // Presses and equipment
  { when: /hot press/i, terms: ["hot press machine", "MEA hot press", "hot press for membrane electrode assembly", "lab hot press"] },
  { when: /30 ton/i, terms: ["30 ton hydraulic press", "hydraulic press machine", "lab hydraulic press", "MHP-30 hydraulic press"] },
  { when: /hydraulic/i, terms: ["20 ton hydraulic press", "hydraulic press machine", "lab hydraulic press", "MHP-20 hydraulic press"] },
  { when: /fuel cell test station/i, terms: ["fuel cell test station", "PEM fuel cell test station", "fuel cell testing equipment", "fuel cell test system"] },
  { when: /testing device/i, terms: ["fuel cell testing device", "metal air battery tester", "fuel cell test equipment"] },
  { when: /temperature/i, terms: ["electrolyzer temperature controller", "PID heating plate", "lab temperature controller"] },
  { when: /triboelectric/i, terms: ["triboelectric measurement setup", "triboelectric test setup", "TENG test setup"] },

  // Materials
  { when: /zinc/i, terms: ["zinc sheet", "pure zinc sheet", "high purity zinc sheet", "zinc metal sheet"] },
  { when: /alumin/i, terms: ["aluminium sheet", "aluminum sheet", "high purity aluminium sheet", "pure aluminium sheet"] },
  { when: /gas sampling/i, terms: ["gas sampling bag", "gas collection bag", "gas bag for GC", "gas sampling bag with PTFE valve"] },
  { when: /manganese/i, terms: ["manganese dioxide nanoparticles", "MnO2 nanoparticles", "MnO2 nanopowder", "manganese oxide nanoparticles"] },
];

// "/" stays: "HgO reference electrode" is worth showing beside "Hg/HgO Reference Electrode".
const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+/]+/g, " ").trim()} `;

/** The names buyers use for this product, most common first. Empty for a product no rule knows. */
export function productSearchTerms(p: { name: string; categorySlug: string }): string[] {
  const rule = RULES.find((r) => r.when.test(p.name) && (!r.category || r.category === p.categorySlug));
  return rule ? rule.terms : [];
}

/** The terms worth showing: not the ones the product's own name already says word for word. */
export function alsoKnownAs(p: { name: string; categorySlug: string }): string[] {
  const name = norm(p.name);
  return productSearchTerms(p).filter((t) => !name.includes(norm(t)));
}
