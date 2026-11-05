import { inclGSTForProduct, isQuoteOnly, type Product } from "@/frontend/lib/catalog";
import type { CategorySeo } from "@/frontend/lib/category-seo";

/**
 * Topic pages (/shop/t/<slug>) for searches wider or narrower than one category.
 * "platinum electrode" alone drew 1,295 impressions on metnmat.in, yet platinum
 * spans two categories and shares them with graphite and gold, so no category
 * page can answer it. Each topic is a real selection of live products with its
 * own guide, not a reworded category: add one only when a search has demand in
 * Search Console and at least three products to show.
 *
 * The rules in category-seo.ts apply: no typed prices or counts, nothing beyond
 * the catalogue and standard electrochemistry.
 */
export type TopicSeo = CategorySeo & {
  /** The category this topic sits under, for the breadcrumb and for the link back. */
  parent: string;
  matches: (p: Pick<Product, "name" | "categorySlug">) => boolean;
};

const inCategory = (p: { categorySlug: string }, ...slugs: string[]) => slugs.includes(p.categorySlug);

export const TOPIC_SEO: Record<string, TopicSeo> = {
  "platinum-electrodes": {
    parent: "counter-electrodes",
    matches: (p) => /platinum|noble metal plate/i.test(p.name) && inCategory(p, "counter-electrodes", "working-electrodes"),
    title: "Platinum Electrode Price in India: Wire, Mesh, Disk",
    h1: "Platinum Electrodes",
    lead: "Platinum wire, sheet, mesh, spiral, ring and disk electrodes for electrochemistry.",
    nouns: "platinum electrodes",
    intro:
      "A platinum electrode, or Pt electrode, is made of platinum metal, which is chosen because it resists corrosion and catalyses many reactions. METNMAT sells platinum wire, sheet, mesh, spiral and ring counter electrodes, and platinum disk working electrodes, in a range of sizes with PTFE or PEEK rods where listed.",
    guideTitle: "Which platinum electrode shape do you need?",
    guide: [
      { term: "Wire", text: "For small cells, where a counter electrode must fit a narrow port." },
      { term: "Sheet or plate", text: "A flat electrode with a known area." },
      { term: "Mesh", text: "The most surface for its size, and open, so gas bubbles and electrolyte pass through." },
      { term: "Spiral or ring", text: "A long length of wire in a small volume, for an even current around the working electrode." },
      { term: "Disk", text: "A polished working electrode with a defined area." },
    ],
    faqs: [
      {
        q: "Why is platinum used for electrodes?",
        a: "It stays inert in most electrolytes, conducts well and catalyses many reactions, so the electrode itself rarely interferes with a measurement.",
      },
      {
        q: "How do I clean a platinum electrode?",
        a: "Common methods are rinsing with deionised water, soaking in dilute nitric acid, and cycling the potential in dilute sulfuric acid. Follow the method your protocol specifies.",
      },
      {
        q: "When should I avoid a platinum counter electrode?",
        a: "In hydrogen evolution catalyst studies, platinum can dissolve and redeposit on the working electrode. Use a graphite counter electrode there.",
      },
    ],
    related: ["counter-electrodes", "working-electrodes", "electrode-holders", "reference-electrodes"],
    keywords: ["platinum electrode", "platinum electrode price", "platinum wire electrode", "platinum mesh electrode", "platinum sheet electrode", "pt electrode", "platinum plate price"],
  },

  "ag-agcl-reference-electrodes": {
    parent: "reference-electrodes",
    matches: (p) => /Ag\/AgCl/.test(p.name) && inCategory(p, "reference-electrodes"),
    title: "Ag/AgCl Reference Electrode Price in India",
    h1: "Ag/AgCl Reference Electrodes",
    lead: "Silver/silver chloride reference electrodes in glass, PTFE and PEEK, from Ø2 mm to Ø6 mm.",
    nouns: "Ag/AgCl reference electrodes",
    intro:
      "An Ag/AgCl reference electrode, also called a silver chloride or AgCl electrode, is a silver wire coated with silver chloride, sitting in a chloride solution, usually KCl. It is one of the most widely used reference electrodes in electrochemistry. METNMAT sells Ag/AgCl electrodes with glass, PTFE and PEEK bodies, from Ø2 mm to Ø6 mm.",
    guideTitle: "How to choose an Ag/AgCl electrode",
    guide: [
      { term: "Potential", text: "It depends on the filling: about +0.197 V vs SHE in saturated KCl, +0.210 V in 3 M KCl and +0.235 V in 1 M KCl, at 25 °C." },
      { term: "Body", text: "Glass suits most work. PTFE or PEEK is tougher and suits electrolytes that attack glass." },
      { term: "Diameter", text: "Match it to the port in your cell. Ø6 mm is common; Ø2 mm and Ø4 mm suit small cells." },
      { term: "When not to use it", text: "For strongly alkaline solutions use Hg/HgO. Where chloride must stay out of the cell use Hg/Hg₂SO₄." },
    ],
    faqs: [
      {
        q: "What is the potential of an Ag/AgCl electrode?",
        a: "About +0.197 V against the standard hydrogen electrode in saturated KCl at 25 °C, and about +0.210 V in 3 M KCl. Always report which filling solution you used.",
      },
      {
        q: "Can I use an Ag/AgCl electrode in KOH?",
        a: "It is not the best choice for strongly alkaline solutions. Hg/HgO is the usual reference there.",
      },
      {
        q: "What is the difference between Ag/AgCl and a calomel electrode?",
        a: "Both use chloride solutions and give a similar potential, but Ag/AgCl contains no mercury. A saturated calomel electrode sits at about +0.241 V vs SHE.",
      },
    ],
    related: ["reference-electrodes", "counter-electrodes", "working-electrodes", "h-cell"],
    keywords: ["Ag/AgCl reference electrode", "Ag/AgCl electrode price", "silver silver chloride electrode", "ag agcl electrode", "AgCl electrode"],
  },

  "hg-hgo-reference-electrodes": {
    parent: "reference-electrodes",
    matches: (p) => /Hg\/HgO|mercury oxide/i.test(p.name) && inCategory(p, "reference-electrodes"),
    title: "Hg/HgO Reference Electrode Price in India",
    h1: "Hg/HgO Reference Electrodes for Alkaline Solutions",
    lead: "Mercury/mercury oxide reference electrodes for KOH and NaOH, in glass, PTFE and PEEK.",
    nouns: "Hg/HgO reference electrodes",
    intro:
      "An Hg/HgO electrode, also written HgO reference electrode or mercury oxide electrode, is the usual reference electrode for alkaline electrolytes such as KOH and NaOH, including alkaline water electrolysis and AEM studies. METNMAT sells Hg/HgO electrodes with glass, PTFE and PEEK bodies, in Ø4 mm and Ø6 mm.",
    guideTitle: "How to use an Hg/HgO electrode",
    guide: [
      { term: "Potential", text: "About +0.098 V vs SHE in 1 M KOH, the value most alkaline electrolysis papers use." },
      { term: "Filling solution", text: "Match it to your electrolyte, commonly 1 M KOH or NaOH." },
      { term: "Body", text: "PTFE or PEEK resists hot, strong alkali better than glass." },
      { term: "Handling", text: "It contains mercury. Follow your lab's rules for storage and disposal." },
    ],
    faqs: [
      {
        q: "Why use Hg/HgO in alkaline solutions?",
        a: "Its reaction involves hydroxide ions, so it is stable in KOH and NaOH, and it leaks no chloride into the cell.",
      },
      {
        q: "How do I convert Hg/HgO to RHE?",
        a: "At 25 °C, E(RHE) = E(Hg/HgO) + 0.098 V + 0.059 × pH, with 0.098 V as the electrode's potential in 1 M KOH. Calibrating your own electrode is more accurate.",
      },
    ],
    related: ["reference-electrodes", "aem-membranes", "water-splitting-reactors"],
    keywords: ["Hg/HgO reference electrode", "Hg/HgO reference electrode price", "mercury oxide electrode", "reference electrode for KOH"],
  },

  "graphite-electrodes": {
    parent: "counter-electrodes",
    matches: (p) => /graphite/i.test(p.name) && inCategory(p, "counter-electrodes", "carbon-gdl"),
    title: "Graphite Electrode Price in India: Rods and Plates",
    h1: "Graphite Electrodes: Rods, Plates and Felt",
    lead: "Graphite rod and plate counter electrodes and graphite felt for electrochemistry.",
    nouns: "graphite electrodes",
    intro:
      "A graphite electrode, also called a carbon rod electrode, is a conductive carbon electrode that costs little and adds no metal contamination, which makes it a common counter electrode. METNMAT sells graphite rods from Ø6 × 60 mm to Ø6 × 120 mm, a graphite plate electrode, and graphite felt in 200 × 200 mm sheets.",
    guideTitle: "Which graphite electrode do you need?",
    guide: [
      { term: "Rod", text: "The usual counter electrode. Choose the length that reaches your electrolyte." },
      { term: "Plate", text: "A flat electrode with a known area." },
      { term: "Felt", text: "A thick, porous sheet with far more surface area, common in flow batteries." },
    ],
    faqs: [
      {
        q: "Is a graphite rod a good counter electrode?",
        a: "Yes. It conducts well and costs less than platinum, and it avoids the risk of platinum depositing on your working electrode.",
      },
      {
        q: "What is the difference between graphite and glassy carbon?",
        a: "Graphite is porous and layered, so it suits counter electrodes and bulk use. Glassy carbon is hard and non-porous, and it can be polished, so it suits working electrodes.",
      },
    ],
    related: ["counter-electrodes", "carbon-gdl", "working-electrodes"],
    keywords: ["graphite electrode", "graphite rod electrode", "graphite rod electrode price", "graphite plate electrode", "graphite felt electrode"],
  },

  "gold-electrodes": {
    parent: "working-electrodes",
    matches: (p) => /gold/i.test(p.name) && inCategory(p, "working-electrodes", "counter-electrodes"),
    title: "Gold Electrode Price in India: Disk and Wire",
    h1: "Gold Electrodes",
    lead: "Gold disk working electrodes in PTFE, PEEK and PCTFE, and a gold wire ring counter electrode.",
    nouns: "gold electrodes",
    intro:
      "A gold electrode, or Au electrode, has a polishable, conductive gold surface that suits sensing and surfaces modified with thiols. METNMAT sells gold disk working electrodes from Ø2 mm to Ø4 mm, straight and L-shaped, with detachable models, and a gold wire ring counter electrode.",
    guideTitle: "How to choose a gold electrode",
    guide: [
      { term: "Disk electrode", text: "A polished working electrode with a defined area. Choose the body that suits your electrolyte." },
      { term: "Straight or L-shaped", text: "Choose the shape that presents the disk where your cell needs it." },
      { term: "Detachable", text: "Lets the electrode head come off its rod." },
      { term: "Wire ring", text: "A counter electrode, for work where gold is needed instead of platinum." },
    ],
    faqs: [
      {
        q: "What is a gold electrode used for?",
        a: "Mainly electrochemical sensing and studies of modified surfaces, because thiols bond readily to gold.",
      },
      {
        q: "How do I clean a gold electrode?",
        a: "Polish with alumina slurry and rinse with deionised water, then cycle the potential in dilute sulfuric acid if your protocol calls for it.",
      },
    ],
    related: ["working-electrodes", "counter-electrodes", "electrode-holders", "reference-electrodes"],
    keywords: ["gold electrode", "gold electrode price", "gold disk electrode", "gold working electrode", "Au electrode"],
  },

  "nickel-foam-and-metal-felt": {
    parent: "carbon-gdl",
    matches: (p) => /nickel|copper foam|titanium felt/i.test(p.name) && inCategory(p, "carbon-gdl", "working-electrodes"),
    title: "Nickel Foam Price in India: Ni Foam, Felt, Cu Foam",
    h1: "Nickel Foam and Metal Felt Electrodes",
    lead: "Nickel foam, nickel fiber felt, copper foam and titanium felt for electrodes and electrolyzers.",
    nouns: "nickel foam and metal felt products",
    intro:
      "Nickel foam, or Ni foam, is a porous, conductive metal sheet with an open-cell structure, widely used as an electrode and catalyst support. METNMAT sells nickel foam, nickel fiber felt, copper foam and titanium felt, as sheets you can cut to fit your cell.",
    guideTitle: "Which porous metal do you need?",
    guide: [
      { term: "Nickel foam", text: "A high-surface open-cell support for alkaline electrolysis and catalyst growth." },
      { term: "Nickel felt", text: "A sintered fibre sheet with finer pores than foam." },
      { term: "Copper foam", text: "An open-cell copper support." },
      { term: "Titanium felt", text: "A corrosion-resistant porous sheet, used in PEM electrolyzers." },
    ],
    faqs: [
      {
        q: "What does PPI mean for nickel foam?",
        a: "Pores per inch. A higher PPI means smaller, more numerous pores and more surface area. METNMAT's nickel foam is 110 PPI, 1.5 mm thick.",
      },
      {
        q: "How is nickel foam cleaned before use?",
        a: "Usually by sonicating in dilute hydrochloric acid to remove the surface oxide, then rinsing with deionised water and ethanol, and drying.",
      },
    ],
    related: ["carbon-gdl", "water-splitting-reactors", "working-electrodes"],
    keywords: ["nickel foam", "nickel foam price", "Ni foam", "nickel foam sheet", "nickel felt", "copper foam", "titanium felt"],
  },

  "glassy-carbon-electrodes": {
    parent: "working-electrodes",
    matches: (p) => /glassy carbon/i.test(p.name) && inCategory(p, "working-electrodes", "electrode-holders"),
    title: "Glassy Carbon Electrode Price in India",
    h1: "Glassy Carbon Electrodes and Holders",
    lead: "Glassy carbon disk electrodes in PTFE and PEEK, and holders for glassy carbon samples.",
    nouns: "glassy carbon electrodes and holders",
    intro:
      "A glassy carbon electrode (GCE) is a hard, non-porous carbon electrode with a wide potential window, and it is the usual surface for testing catalyst inks. METNMAT sells Ø3 mm glassy carbon disk electrodes, straight and L-shaped, in PTFE and PEEK, and PEEK holders for glassy carbon.",
    guideTitle: "How to choose and use a glassy carbon electrode",
    guide: [
      { term: "Straight or L-shaped", text: "Choose the shape that presents the disk where your cell needs it." },
      { term: "PTFE or PEEK body", text: "PTFE is the most chemically inert; PEEK is stiffer." },
      { term: "Area", text: "A Ø3 mm disk has an area of 0.0707 cm², for reporting current density." },
      { term: "Before each run", text: "Polish with alumina slurry and rinse well, so that results repeat." },
    ],
    faqs: [
      {
        q: "How do I load a catalyst on a glassy carbon electrode?",
        a: "Polish and dry the disk, drop-cast a measured volume of catalyst ink on it, and let it dry evenly before testing.",
      },
      {
        q: "How do I polish a glassy carbon electrode?",
        a: "Use an alumina slurry on a polishing pad in a figure-eight motion, then rinse with deionised water. A short sonication removes leftover alumina.",
      },
    ],
    related: ["working-electrodes", "electrode-holders", "consumables", "counter-electrodes"],
    keywords: ["glassy carbon electrode", "glassy carbon electrode price", "GCE electrode", "glassy carbon disk electrode"],
  },

  "platinum-wire-electrodes": {
    parent: "counter-electrodes",
    matches: (p) => /platinum wire/i.test(p.name) && !/ring/i.test(p.name) && inCategory(p, "counter-electrodes"),
    title: "Platinum Wire Electrode Price in India: PTFE, PEEK",
    h1: "Platinum Wire Electrodes",
    lead: "Platinum wire counter electrodes on PTFE and PEEK rods.",
    nouns: "platinum wire electrodes",
    intro:
      "A platinum wire electrode, or Pt wire electrode, is a length of platinum wire on an insulated rod. It is the most common counter electrode, also called an auxiliary electrode, because it stays inert and fits narrow ports. METNMAT sells platinum wire electrodes on PTFE and PEEK rods.",
    guideTitle: "How to choose a platinum wire electrode",
    guide: [
      { term: "Wire diameter", text: "A thicker wire is sturdier and has more surface for its length." },
      { term: "Rod material", text: "PTFE is the most chemically inert. PEEK is stiffer and handles heat better." },
      { term: "Surface area", text: "The counter electrode should have more surface than the working electrode, so that it does not limit the current." },
      { term: "When a wire is too small", text: "For large working electrodes, choose a mesh or a sheet instead." },
    ],
    faqs: [
      {
        q: "What is a platinum wire electrode used for?",
        a: "Mostly as the counter electrode in a three-electrode cell, where it carries the current while the working electrode is measured.",
      },
      {
        q: "What is the difference between a counter and an auxiliary electrode?",
        a: "Nothing. They are two names for the same electrode.",
      },
      {
        q: "Can I use a platinum wire for hydrogen evolution studies?",
        a: "Take care. Platinum can dissolve from the counter electrode and redeposit on the working electrode, which inflates catalyst activity. Many labs use graphite for this work.",
      },
    ],
    related: ["counter-electrodes", "working-electrodes", "electrode-holders", "reference-electrodes"],
    keywords: ["platinum wire electrode", "platinum wire electrode price", "pt wire electrode", "platinum wire counter electrode", "platinum wire auxiliary electrode"],
  },

  "platinum-mesh-electrodes": {
    parent: "counter-electrodes",
    matches: (p) => /platinum mesh/i.test(p.name) && inCategory(p, "counter-electrodes"),
    title: "Platinum Mesh Electrode Price in India",
    h1: "Platinum Mesh Electrodes",
    lead: "Woven platinum mesh counter electrodes in several sizes.",
    nouns: "platinum mesh electrodes",
    intro:
      "A platinum mesh electrode, also called platinum gauze, is woven from fine platinum wire. The weave gives far more surface than a wire or sheet of the same outline, and it lets electrolyte and gas bubbles pass through. METNMAT sells platinum mesh counter electrodes in several sizes.",
    guideTitle: "How to choose a platinum mesh electrode",
    guide: [
      { term: "Size", text: "Match the mesh to the working electrode and the cell: it should face the working electrode evenly." },
      { term: "Mesh or sheet", text: "Mesh has more surface and passes gas bubbles. A sheet has a known flat area." },
      { term: "Handling", text: "Mesh is soft and bends easily, so do not press it against the cell wall." },
    ],
    faqs: [
      {
        q: "Why use a platinum mesh counter electrode?",
        a: "It offers a large surface in a small space, so it does not limit the current, and bubbles escape through it rather than sticking to it.",
      },
      {
        q: "Is platinum mesh the same as platinum gauze?",
        a: "Yes. Both names describe a woven platinum wire electrode.",
      },
    ],
    related: ["counter-electrodes", "working-electrodes", "electrode-holders", "reactor-cell"],
    keywords: ["platinum mesh electrode", "platinum mesh electrode price", "platinum mesh counter electrode", "platinum gauze electrode", "pt mesh electrode"],
  },

  "platinum-sheet-electrodes": {
    parent: "counter-electrodes",
    matches: (p) => /platinum sheet|noble metal plate/i.test(p.name) && inCategory(p, "counter-electrodes"),
    title: "Platinum Sheet & Plate Electrode Price in India",
    h1: "Platinum Sheet and Plate Electrodes",
    lead: "Platinum sheet and plate electrodes in sizes from 10 × 10 mm to 30 × 30 mm.",
    nouns: "platinum sheet electrodes",
    intro:
      "A platinum sheet electrode, also called a platinum plate or foil electrode, is a thin flat piece of platinum on a connecting wire. Its flat shape gives a known area and an even current across the working electrode. METNMAT sells platinum sheet and plate electrodes in a range of sizes.",
    guideTitle: "How to choose a platinum sheet electrode",
    guide: [
      { term: "Area", text: "Choose a sheet with more surface than your working electrode, counting both faces." },
      { term: "Sheet or mesh", text: "A sheet has a known flat area. Mesh has more surface and lets bubbles through." },
      { term: "Fit", text: "Check that the width passes through the port of your cell." },
    ],
    faqs: [
      {
        q: "What is the difference between a platinum sheet and a platinum plate electrode?",
        a: "They are the same kind of electrode. Sheet, plate and foil all describe a thin flat piece of platinum.",
      },
      {
        q: "How do I work out the area of a platinum sheet electrode?",
        a: "Multiply the width by the height for one face, then double it if both faces sit in the electrolyte.",
      },
    ],
    related: ["counter-electrodes", "working-electrodes", "electrode-holders", "reactor-cell"],
    keywords: ["platinum sheet electrode", "platinum plate electrode", "platinum plate price", "platinum foil electrode", "pt foil electrode", "platinum sheet price"],
  },

  "pem-electrolyzers": {
    parent: "water-splitting-reactors",
    matches: (p) => /pem hydrogen|pem\/aem|research-scale electrolyzer|ewf transparent/i.test(p.name) && inCategory(p, "water-splitting-reactors"),
    title: "PEM Electrolyzer Price in India: Lab Cells, Hardware",
    h1: "PEM Electrolyzers",
    lead: "PEM electrolyzer cells and test hardware for hydrogen and water electrolysis research.",
    nouns: "PEM electrolyzers",
    intro:
      "A PEM electrolyzer splits purified water into hydrogen and oxygen, using a proton exchange membrane as the electrolyte. Protons cross the membrane from the anode to the cathode, where they form hydrogen. METNMAT sells a compact PEM hydrogen electrolyzer cell for lab hydrogen, and research hardware for testing your own membrane electrode assemblies.",
    guideTitle: "How to choose a PEM electrolyzer",
    guide: [
      { term: "Hydrogen source or test hardware", text: "A compact cell gives you hydrogen for an experiment. Test hardware lets you build and measure your own membrane electrode assembly." },
      { term: "Hydrogen output", text: "A compact cell is rated in mL/min of hydrogen, so size it to what your experiment uses." },
      { term: "Active area", text: "Test hardware is sized by electrode area in cm². A small area uses less catalyst and membrane per test." },
      { term: "Water", text: "Use purified or deionised water. Dissolved ions in tap water foul the membrane." },
      { term: "Temperature", text: "Hardware with a heating plate and a thermocouple lets you test above room temperature." },
    ],
    faqs: [
      {
        q: "How does a PEM electrolyzer work?",
        a: "Water splits at the anode into oxygen, protons and electrons. The protons cross the membrane and join the electrons at the cathode to form hydrogen.",
      },
      {
        q: "What is the difference between a PEM and an AEM electrolyzer?",
        a: "A PEM electrolyzer carries protons through an acidic membrane and usually needs platinum group catalysts. An AEM electrolyzer carries hydroxide ions through an alkaline membrane, which allows non-precious catalysts.",
      },
      {
        q: "What water does a PEM electrolyzer need?",
        a: "Purified or deionised water. Dissolved ions foul the membrane and shorten its life, so tap water is not suitable.",
      },
      {
        q: "Can this hardware also take an AEM membrane?",
        a: "Some of it can. The specifications of each model list the membranes it is compatible with.",
      },
    ],
    related: ["water-splitting-reactors", "pem-membranes", "aem-membranes", "carbon-gdl", "fuel-cells"],
    keywords: ["PEM electrolyzer", "PEM electrolyzer price", "PEM electrolyser", "PEM water electrolyzer", "hydrogen electrolyzer", "PEM electrolyzer cell", "lab electrolyzer"],
  },

  "fumasep-membranes": {
    parent: "membranes",
    matches: (p) => /fumasep/i.test(p.name) && inCategory(p, "aem-membranes", "cem-membranes", "bipolar-membranes"),
    title: "Fumasep Membrane Price in India: FAA-3, FS-9100, FBM",
    h1: "Fumasep Membranes",
    lead: "Fumasep anion exchange, cation exchange and bipolar membranes for electrochemistry.",
    nouns: "Fumasep membranes",
    intro:
      "Fumasep is a family of ion exchange membranes from FUMATECH, used in electrolyzers, fuel cells, flow batteries and electrodialysis. METNMAT sells Fumasep anion exchange membranes such as FAA-3 and FAB, the FS-9100 cation exchange membrane and the FBM bipolar membrane.",
    guideTitle: "Which Fumasep membrane do you need?",
    guide: [
      { term: "FAA-3", text: "An anion exchange membrane in thin grades. Thinner means lower resistance, but a weaker film." },
      { term: "FAB", text: "A reinforced anion exchange membrane, stronger and easier to handle than a thin film." },
      { term: "FS-9100", text: "A cation exchange membrane, which passes positive ions." },
      { term: "FBM", text: "A bipolar membrane, with an anion and a cation layer joined together. It splits water into H⁺ and OH⁻ at the junction." },
    ],
    faqs: [
      {
        q: "What is a Fumasep membrane?",
        a: "An ion exchange membrane from FUMATECH. The name covers anion exchange, cation exchange and bipolar types.",
      },
      {
        q: "What is the difference between anion and cation exchange membranes?",
        a: "An anion exchange membrane passes negative ions such as hydroxide. A cation exchange membrane passes positive ions such as sodium or protons.",
      },
      {
        q: "Which Fumasep membrane suits water electrolysis?",
        a: "Anion exchange types such as FAA-3 are the usual choice for alkaline membrane water electrolysis. Check the membrane against your electrolyte and temperature.",
      },
    ],
    related: ["membranes", "aem-membranes", "cem-membranes", "bipolar-membranes", "consumables"],
    keywords: ["Fumasep membrane", "Fumasep price", "Fumasep FAA-3", "FAA-3-50", "Fumasep FAB-PK-130", "Fumasep FS-9100", "Fumasep FBM", "Fumasep anion exchange membrane"],
  },

  "swagelok-cells": {
    parent: "battery-reactors",
    matches: (p) => /swagelok/i.test(p.name) && inCategory(p, "battery-reactors"),
    title: "Swagelok Cell Price in India: Battery Test Cells",
    h1: "Swagelok Cells for Battery Testing",
    lead: "Swagelok type battery test cells in SS316 with PTFE or PEEK insulation.",
    nouns: "Swagelok cells",
    intro:
      "A Swagelok cell is a reusable battery test cell built from stainless steel tube fittings, which hold the electrodes and separator together and seal them. Labs use it to test battery materials without building a full coin or pouch cell. METNMAT sells Swagelok type cells in SS316, with PTFE or PEEK insulation.",
    guideTitle: "How to choose a Swagelok cell",
    guide: [
      { term: "PTFE or PEEK insulation", text: "PTFE is the most chemically inert. PEEK is stiffer and holds its shape under clamping." },
      { term: "Two electrodes", text: "A two-electrode cell measures the voltage of the whole cell." },
      { term: "Assembly", text: "Assemble it in a glove box for air-sensitive materials such as lithium metal." },
      { term: "Reuse", text: "The parts can be cleaned and used again, unlike a coin cell." },
    ],
    faqs: [
      {
        q: "What is a Swagelok cell?",
        a: "A reusable battery test cell based on stainless steel tube fittings. The electrodes and a separator sit between two current collectors, and the fitting seals them.",
      },
      {
        q: "Should I use a Swagelok cell or a coin cell?",
        a: "A coin cell is cheap and single use, but needs a crimper. A Swagelok cell costs more, can be used again and is quick to assemble when screening materials.",
      },
      {
        q: "What can I test in a Swagelok cell?",
        a: "Electrode materials for lithium ion, sodium ion and similar batteries, in a two-electrode setup.",
      },
    ],
    related: ["battery-reactors", "reactor-cell", "fuel-cells"],
    keywords: ["Swagelok cell", "Swagelok cell price", "Swagelok type cell", "Swagelok battery cell", "battery test cell", "battery test fixture"],
  },
};

/** Cheapest first, for buyers comparing prices; items without a price go last. */
export function topicProducts(topic: TopicSeo, all: Product[]): Product[] {
  const price = (p: Product) => (p.price > 0 && !isQuoteOnly(p) ? inclGSTForProduct(p, p.price) : Infinity);
  return all.filter(topic.matches).sort((a, b) => price(a) - price(b));
}

/** Every topic page, for the header menu and the home page. */
export const topicLinks = () => Object.entries(TOPIC_SEO).map(([slug, t]) => ({ href: `/shop/t/${slug}`, name: t.h1 }));

/** Topics that sit under a category, for the links on its page. */
export const topicsForCategory = (category: string) =>
  Object.entries(TOPIC_SEO)
    .filter(([, t]) => t.parent === category || t.related.includes(category))
    .map(([slug, t]) => ({ href: `/shop/t/${slug}`, name: t.h1 }));
