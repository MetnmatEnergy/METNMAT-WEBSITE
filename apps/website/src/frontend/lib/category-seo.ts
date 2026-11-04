import { formatINR, inclGSTForProduct, isQuoteOnly, type Product } from "@/frontend/lib/catalog";

/**
 * Landing-page content for the shop's categories: docs/seo/RANKING-MASTER-PROMPT.md.
 *
 * Categories are the pages that can rank for what buyers type ("reference
 * electrode", "platinum electrode price"), and the CMS holds only a one-line
 * blurb for them. Titles and H1s use the words from Search Console; the intro
 * opens with a plain definition, which is the sentence answer engines quote.
 *
 * No claim here may go beyond the catalogue or standard electrochemistry. Counts
 * and prices are never written down: they are computed from the live products
 * (categoryPriceFacts), so they cannot go stale. Potentials are textbook values
 * at 25 °C. Third-party names are used only for products actually sold; N117,
 * N115 and N212 are PFSA membranes and must not be called Nafion.
 */
export type CategorySeo = {
  /** <title> before the layout's " · METNMAT"; at most 52 characters. */
  title: string;
  h1: string;
  /** Opens the meta description; live count and price follow it. */
  lead: string;
  /** The buyer's word for these products, used in the generated price FAQ. */
  nouns: string;
  intro: string;
  guideTitle: string;
  guide: { term: string; text: string }[];
  faqs: { q: string; a: string }[];
  /** Sibling categories worth a link: category slugs. */
  related: string[];
  keywords: string[];
};

export const CATEGORY_SEO: Record<string, CategorySeo> = {
  electrodes: {
    title: "Electrochemistry Electrodes: Buy Online in India",
    h1: "Electrodes for Electrochemistry",
    lead: "Reference, counter and working electrodes for three-electrode electrochemistry.",
    nouns: "laboratory electrodes",
    intro:
      "A three-electrode cell uses a working electrode where the reaction is studied, a reference electrode that fixes the potential scale, and a counter electrode that carries the current. METNMAT sells all three, in Ag/AgCl, calomel, Hg/HgO, platinum, gold, glassy carbon and graphite, with a price on every product.",
    guideTitle: "Which electrode do you need?",
    guide: [
      { term: "Reference electrode", text: "Sets the potential scale. Choose it by electrolyte: Ag/AgCl or calomel for neutral and acidic solutions, Hg/HgO for alkaline ones." },
      { term: "Counter electrode", text: "Completes the circuit. Platinum is the inert default; graphite avoids any risk of platinum depositing on the sample." },
      { term: "Working electrode", text: "Where the measurement happens. Glassy carbon, gold and platinum disks are the usual polished surfaces." },
      { term: "Electrode holder", text: "Connects your own sheet, foil or foam sample as the working electrode, without soldering." },
    ],
    faqs: [
      {
        q: "What is a three-electrode system?",
        a: "It separates the two jobs of a cell. Current flows between the working and counter electrodes, while the potential of the working electrode is measured against a reference electrode that carries almost no current, so the reading stays stable.",
      },
    ],
    related: ["reference-electrodes", "counter-electrodes", "working-electrodes", "electrode-holders"],
    keywords: ["electrochemistry electrodes", "three electrode system", "electrodes for electrochemistry India"],
  },

  "reference-electrodes": {
    title: "Reference Electrodes, Ag/AgCl, SCE: Price in India",
    h1: "Reference Electrodes: Ag/AgCl, Calomel, Hg/HgO",
    lead: "Ag/AgCl, saturated calomel, Hg/HgO, Hg/Hg₂SO₄ and Ag/Ag⁺ reference electrodes.",
    nouns: "reference electrodes",
    intro:
      "A reference electrode holds a stable, known potential, so the working electrode in a three-electrode cell can be measured against it. METNMAT sells Ag/AgCl, saturated calomel (SCE), Hg/HgO, mercurous sulfate (Hg/Hg₂SO₄) and non-aqueous Ag/Ag⁺ reference electrodes, with glass, PTFE and PEEK bodies from Ø2 mm to Ø6 mm.",
    guideTitle: "Which reference electrode for which electrolyte?",
    guide: [
      { term: "Neutral or acidic aqueous solutions", text: "Ag/AgCl (about +0.197 V vs SHE in saturated KCl) or saturated calomel (about +0.241 V vs SHE)." },
      { term: "Alkaline solutions such as KOH or NaOH", text: "Hg/HgO (about +0.10 V vs SHE in 1 M KOH), the usual choice for alkaline water electrolysis." },
      { term: "Acid where chloride must stay out", text: "Mercurous sulfate, Hg/Hg₂SO₄ (about +0.64 V vs SHE in saturated K₂SO₄), which leaks no chloride into the cell." },
      { term: "Non-aqueous solvents", text: "Ag/Ag⁺, for organic electrolytes such as acetonitrile." },
      { term: "Body and diameter", text: "Glass suits most work; choose PTFE or PEEK where the electrolyte attacks glass, such as strong alkali. Match the diameter to the port in your cell." },
    ],
    faqs: [
      {
        q: "Which reference electrode should I use in KOH?",
        a: "Use Hg/HgO. It is built for alkaline electrolytes, and it is the usual reference for alkaline water electrolysis and AEM studies.",
      },
      {
        q: "How do I convert a potential to the RHE scale?",
        a: "At 25 °C, E(RHE) = E(measured) + E(reference vs SHE) + 0.059 × pH. For Ag/AgCl in saturated KCl, E(reference vs SHE) is about 0.197 V.",
      },
      {
        q: "How should a reference electrode be stored?",
        a: "Keep the tip wet in its own filling solution, for example saturated KCl for Ag/AgCl, and never let it dry out. Keep the filling level above the level of the test solution while in use.",
      },
    ],
    related: ["counter-electrodes", "working-electrodes", "h-cell", "electrode-holders"],
    keywords: ["reference electrode", "Ag/AgCl reference electrode price", "calomel electrode price", "Hg/HgO reference electrode", "SCE electrode", "reference electrode price India"],
  },

  "counter-electrodes": {
    title: "Platinum & Graphite Counter Electrodes: Price India",
    h1: "Counter Electrodes: Platinum, Graphite and Gold",
    lead: "Platinum wire, sheet, mesh and spiral, gold ring and graphite rod counter electrodes.",
    nouns: "counter electrodes",
    intro:
      "A counter electrode, also called an auxiliary electrode, carries the current in a three-electrode cell so that the reference electrode stays undisturbed. METNMAT sells platinum wire, sheet, mesh, spiral and ring electrodes, gold wire rings, and graphite rods and plates, on PTFE or PEEK rods where listed.",
    guideTitle: "How to choose a counter electrode",
    guide: [
      { term: "Platinum", text: "The inert default for most aqueous work. Mesh and sheet give the most area; wire suits small cells." },
      { term: "Graphite", text: "Low cost, and the safer choice for catalyst studies, because platinum can dissolve and redeposit on the working electrode." },
      { term: "Gold", text: "For work where a gold surface is needed instead of platinum." },
      { term: "Size", text: "Use more surface area than the working electrode, so that the counter electrode never limits the current." },
    ],
    faqs: [
      {
        q: "Why use a graphite counter electrode instead of platinum?",
        a: "Platinum can dissolve at high anodic potentials and redeposit on the working electrode, which can make a catalyst look better than it is, especially in hydrogen evolution studies. Graphite avoids that contamination and costs less.",
      },
      {
        q: "How large should a counter electrode be?",
        a: "As a rule of thumb, its surface area should be several times that of the working electrode, so the reaction at the counter electrode does not limit the current.",
      },
    ],
    related: ["reference-electrodes", "working-electrodes", "electrode-holders", "carbon-gdl"],
    keywords: ["platinum electrode", "platinum electrode price", "platinum counter electrode", "platinum mesh electrode", "graphite rod electrode", "graphite electrode", "platinum wire electrode"],
  },

  "working-electrodes": {
    title: "Glassy Carbon & Gold Working Electrodes: Price India",
    h1: "Working Electrodes: Glassy Carbon, Gold and Platinum",
    lead: "Glassy carbon, gold and platinum disk working electrodes, straight and L-shaped.",
    nouns: "working electrodes",
    intro:
      "The working electrode is where the reaction under study takes place. METNMAT sells glassy carbon, gold and platinum disk electrodes from Ø2 mm to Ø4 mm, straight or L-shaped, in PTFE or PEEK bodies, with detachable models, plus titanium felt.",
    guideTitle: "How to choose a working electrode",
    guide: [
      { term: "Glassy carbon", text: "A wide potential window and a low background current. It is the usual support for catalyst inks." },
      { term: "Gold", text: "Suited to sensing work and to surfaces modified with thiols." },
      { term: "Platinum", text: "Used for hydrogen, oxygen and alcohol oxidation studies." },
      { term: "Disk size", text: "A Ø3 mm disk has an area of 0.0707 cm², the figure needed to report current density." },
    ],
    faqs: [
      {
        q: "How do I polish a glassy carbon electrode?",
        a: "Polish on a pad with an alumina slurry in a figure-eight motion, working down to the finest grade, then rinse well with deionised water. A short sonication removes leftover alumina.",
      },
      {
        q: "What is the area of a 3 mm disk electrode?",
        a: "0.0707 cm², from π × (0.15 cm)². Use this geometric area to convert measured current to current density.",
      },
    ],
    related: ["reference-electrodes", "counter-electrodes", "electrode-holders", "consumables"],
    keywords: ["glassy carbon electrode", "glassy carbon electrode price", "gold disk electrode", "platinum disk electrode", "working electrode"],
  },

  "electrode-holders": {
    title: "Electrode Holders, PTFE & PEEK: Price in India",
    h1: "Electrode Holders in PTFE and PEEK",
    lead: "PTFE and PEEK electrode holders with platinum, titanium and copper contacts.",
    nouns: "electrode holders",
    intro:
      "An electrode holder grips a sheet, foil or plate and makes the electrical contact, so your own sample can be the working electrode without soldering a wire to it. METNMAT sells PTFE and PEEK holders with platinum, titanium, copper and stainless steel contacts, with replaceable parts and slit widths of 1, 3 and 8 mm on glassy carbon holders.",
    guideTitle: "How to choose an electrode holder",
    guide: [
      { term: "Contact metal", text: "Platinum is the most inert. Titanium resists corrosion at lower cost. Copper and stainless steel clips suit contacts kept out of the electrolyte." },
      { term: "Body", text: "PTFE is the most chemically inert. PEEK is stiffer and keeps its shape when clamped." },
      { term: "Sample size", text: "Check the slit or clamp against the thickness and width of your sample." },
    ],
    faqs: [
      {
        q: "What is the difference between PTFE and PEEK electrode holders?",
        a: "PTFE resists almost every electrolyte but is soft. PEEK is stiffer and holds its dimensions better under clamping force. Choose PTFE for the harshest chemistry and PEEK where rigidity matters.",
      },
    ],
    related: ["working-electrodes", "counter-electrodes", "reference-electrodes", "reactor-cell"],
    keywords: ["electrode holder", "PTFE electrode holder", "working electrode holder", "platinum electrode holder", "crocodile clip electrode holder"],
  },

  membranes: {
    title: "Ion Exchange Membranes (PEM, AEM, CEM, BPM), India",
    h1: "Ion Exchange Membranes",
    lead: "Proton, anion, cation and bipolar exchange membranes for electrolysis and fuel cells.",
    nouns: "ion exchange membranes",
    intro:
      "An ion exchange membrane separates the two sides of a cell while letting only certain ions through. METNMAT sells proton exchange (PEM), anion exchange (AEM), cation exchange (CEM) and bipolar membranes, including FUMATECH, Dioxide Materials and Versogen products.",
    guideTitle: "Which membrane type do you need?",
    guide: [
      { term: "PEM", text: "Carries protons in acidic systems: PEM fuel cells and PEM water electrolysis." },
      { term: "AEM", text: "Carries hydroxide ions in alkaline systems, which allows catalysts without platinum-group metals." },
      { term: "CEM", text: "Passes cations and blocks anions, for electrodialysis and divided cells." },
      { term: "Bipolar", text: "Splits water into H⁺ and OH⁻ at an internal junction under an applied voltage." },
    ],
    faqs: [
      {
        q: "What is the difference between a PEM and an AEM?",
        a: "A PEM conducts protons in an acidic environment, which generally needs platinum-group catalysts. An AEM conducts hydroxide ions in an alkaline environment, which allows cheaper non-noble catalysts.",
      },
    ],
    related: ["pem-membranes", "aem-membranes", "cem-membranes", "bipolar-membranes", "consumables"],
    keywords: ["ion exchange membrane", "ion exchange membrane India", "membrane for electrolysis"],
  },

  "pem-membranes": {
    title: "Proton Exchange Membrane Price: N117, N115, N212",
    h1: "Proton Exchange Membranes (PFSA): N117, N115, N212",
    lead: "PFSA proton exchange membranes in N117, N115 and N212 grades, including 300 × 300 mm.",
    nouns: "proton exchange membranes",
    intro:
      "A proton exchange membrane (PEM) conducts protons while keeping the gases on each side of a fuel cell or electrolyzer apart. METNMAT's N117, N115 and N212 grades are perfluorosulfonic acid (PFSA) membranes, the polymer family that Nafion® also belongs to, and a 300 × 300 mm PFSA sheet is available for larger cells.",
    guideTitle: "How to choose a PFSA membrane",
    guide: [
      { term: "Thin, such as N212", text: "Lower resistance and higher performance, with more gas crossover. Common in fuel cells." },
      { term: "Thick, such as N117", text: "More robust and with less crossover. Common in electrolyzers and divided lab cells." },
      { term: "N115", text: "Sits between the two in thickness." },
      { term: "Ionomer", text: "Use a PFSA dispersion in the catalyst layer to match the membrane." },
    ],
    faqs: [
      {
        q: "Are N117 and N115 the same as Nafion?",
        a: "They are PFSA membranes, the same polymer family, but these listings are not sold as Nafion®, which is a trademark of The Chemours Company. Check the product's specification table against your protocol.",
      },
      {
        q: "Does a PFSA membrane need pretreatment?",
        a: "Usually yes. A common sequence is heating in dilute hydrogen peroxide, then deionised water, then dilute sulfuric acid, then deionised water again. Follow your own protocol if it differs.",
      },
    ],
    related: ["aem-membranes", "consumables", "water-splitting-reactors", "fuel-cells"],
    keywords: ["proton exchange membrane", "proton exchange membrane price", "PEM membrane", "PFSA membrane", "N117 membrane", "N212 membrane"],
  },

  "aem-membranes": {
    title: "Anion Exchange Membranes: Fumasep, PiperION, India",
    h1: "Anion Exchange Membranes (AEM)",
    lead: "Fumasep FAA-3, Sustainion X37 and PiperION anion exchange membranes.",
    nouns: "anion exchange membranes",
    intro:
      "An anion exchange membrane (AEM) conducts hydroxide and other anions, and it is the core of AEM water electrolysis and many CO₂ electrolyzers. METNMAT sells Fumasep FAA-3 and FAB-PK-130 (FUMATECH), Sustainion X37 (Dioxide Materials), PiperION (Versogen) and its own AEM.",
    guideTitle: "How to choose an AEM",
    guide: [
      { term: "CO₂ electrolysis", text: "Sustainion X37 was developed for CO₂ electrolysis." },
      { term: "Water electrolysis", text: "Compare Fumasep FAA-3 and PiperION for your operating temperature and KOH strength." },
      { term: "Mechanical strength", text: "Reinforced grades such as FAB-PK-130 handle more clamping stress than thin unreinforced films." },
      { term: "Ionomer", text: "Pair the membrane with a matching anion ionomer in the catalyst layer." },
    ],
    faqs: [
      {
        q: "Does an anion exchange membrane need activation?",
        a: "Most are shipped in a halide or carbonate form and are exchanged to the hydroxide form in KOH before use. Follow the maker's instructions for the exact grade.",
      },
    ],
    related: ["pem-membranes", "bipolar-membranes", "consumables", "co2-electrolysis"],
    keywords: ["anion exchange membrane", "AEM membrane", "Fumasep FAA-3", "Sustainion X37", "PiperION membrane", "anion exchange membrane India"],
  },

  "cem-membranes": {
    title: "Cation Exchange Membrane: Fumasep FS-9100, India",
    h1: "Cation Exchange Membranes (CEM)",
    lead: "Fumasep cation exchange membrane for electrodialysis and divided electrochemical cells.",
    nouns: "cation exchange membranes",
    intro:
      "A cation exchange membrane (CEM) lets positive ions through and blocks negative ones, which keeps the two sides of a divided cell apart while the circuit stays complete. METNMAT sells the FUMATECH Fumasep FS-9100-PK.",
    guideTitle: "Where a CEM is used",
    guide: [
      { term: "Divided cells", text: "Keeps anode and cathode products apart while ions complete the circuit." },
      { term: "Electrodialysis", text: "Paired with anion exchange membranes to separate salts." },
    ],
    faqs: [
      {
        q: "What is the difference between a cation and an anion exchange membrane?",
        a: "A cation exchange membrane carries fixed negative groups and passes positive ions. An anion exchange membrane carries fixed positive groups and passes negative ions.",
      },
    ],
    related: ["pem-membranes", "aem-membranes", "bipolar-membranes", "h-cell"],
    keywords: ["cation exchange membrane", "Fumasep FS-9100", "CEM membrane"],
  },

  "bipolar-membranes": {
    title: "Bipolar Membrane: Fumasep FBM, Price in India",
    h1: "Bipolar Membranes (BPM)",
    lead: "Fumasep FBM bipolar ion exchange membrane for electrodialysis and CO₂ electrolysis research.",
    nouns: "bipolar membranes",
    intro:
      "A bipolar membrane joins a cation exchange layer to an anion exchange layer. Under reverse bias it splits water at the junction into H⁺ and OH⁻, which lets one cell hold a different pH on each side. METNMAT sells the FUMATECH Fumasep FBM.",
    guideTitle: "Where a bipolar membrane is used",
    guide: [
      { term: "Bipolar electrodialysis", text: "Produces acid and base from a salt solution." },
      { term: "Electrolysis research", text: "Keeps an acidic and an alkaline side in the same cell." },
    ],
    faqs: [
      {
        q: "How does a bipolar membrane work?",
        a: "Water at the junction between its two layers dissociates under the applied field. Protons leave through the cation layer and hydroxide ions through the anion layer.",
      },
    ],
    related: ["aem-membranes", "cem-membranes", "co2-electrolysis"],
    keywords: ["bipolar membrane", "Fumasep FBM", "BPM membrane"],
  },

  "reactor-cell": {
    title: "Electrochemical Cells & Reactors for Labs, India",
    h1: "Electrochemical Cells and Reactors",
    lead: "Electrochemical cells, electrolyzers and flow reactors for laboratory research.",
    nouns: "electrochemical cells and reactors",
    intro:
      "An electrochemical cell holds the electrodes and electrolyte for an experiment; a reactor adds the flow, gas handling or light access the work needs. METNMAT sells single-chamber glass cells, water-jacketed cells, H-cells, water electrolyzers, CO₂ flow cells, fuel cell hardware and battery test cells.",
    guideTitle: "Which cell fits your experiment?",
    guide: [
      { term: "Single-chamber cell", text: "The simplest three-electrode setup; water-jacketed models hold a set temperature." },
      { term: "H-cell", text: "Two chambers with a membrane between them, to keep anode and cathode products apart." },
      { term: "Flow cell or electrolyzer", text: "For high current density and for gas-fed reactions." },
      { term: "Custom build", text: "Use 'Request for Customization' on any product to send your design, size and material." },
    ],
    faqs: [
      {
        q: "Can METNMAT make a custom electrochemical cell?",
        a: "Yes. Use the 'Request for Customization' option on any product to share your design, size, material and quantity, and the team will reply with a quote.",
      },
    ],
    related: ["h-cell", "water-splitting-reactors", "co2-electrolysis", "battery-reactors", "fuel-cells"],
    keywords: ["electrochemical cell", "electrochemical cell supplier India", "electrochemical reactor", "water jacketed electrochemical cell", "custom electrochemical cell"],
  },

  "h-cell": {
    title: "H-Cell Electrochemical Cells, H-Type: Price India",
    h1: "H-Cells: H-Type Electrochemical Cells",
    lead: "H-type dual-chamber electrochemical cells in 30, 50 and 100 mL per side.",
    nouns: "H-cells",
    intro:
      "An H-cell is a two-chamber electrochemical cell with a membrane in the bridge between the chambers, which keeps anode and cathode products apart. METNMAT sells H-type cells with 30, 50 and 100 mL per chamber, including a gas-tight model with PTFE lids and gas purge ports.",
    guideTitle: "How to choose an H-cell",
    guide: [
      { term: "Volume", text: "Smaller chambers concentrate products for detection. Larger ones hold more electrolyte for longer runs." },
      { term: "Gas-tight or open", text: "Choose a gas-tight cell when you analyse gas products, for example in CO₂ reduction." },
      { term: "Membrane", text: "Fit a PEM for acidic electrolytes or an AEM for alkaline ones." },
    ],
    faqs: [
      {
        q: "What is an H-cell used for?",
        a: "For experiments where the products at each electrode must stay apart, such as CO₂ reduction, electrosynthesis and catalyst screening. The membrane in the bridge lets ions pass while limiting product crossover.",
      },
      {
        q: "When should I move from an H-cell to a flow cell?",
        a: "When you need higher current density. Dissolved CO₂ limits an H-cell, while a gas diffusion flow cell feeds gas straight to the catalyst.",
      },
    ],
    related: ["reactor-cell", "co2-electrolysis", "pem-membranes", "aem-membranes", "reference-electrodes"],
    keywords: ["H-cell", "H type electrochemical cell", "H cell price", "dual chamber electrochemical cell", "H-type electrolytic cell"],
  },

  "water-splitting-reactors": {
    title: "Water Electrolysis Cells & PEM Electrolyzers, India",
    h1: "Water-Splitting Reactors and Electrolyzer Cells",
    lead: "PEM and AEM electrolyzer hardware, zero-gap cells and water-splitting reactors.",
    nouns: "water-splitting reactors",
    intro:
      "A water-splitting reactor uses electricity to split water into hydrogen and oxygen, and lets you test catalysts, membranes and operating conditions. METNMAT sells PEM electrolyzer cells, zero-gap flow electrolyzers, transparent and PTFE reactors, high-temperature PEM/AEM hardware and a 5 cm² research-scale cell.",
    guideTitle: "How to choose an electrolyzer cell",
    guide: [
      { term: "Catalyst screening", text: "Three-electrode reactors isolate one electrode at a time." },
      { term: "Device-level testing", text: "Zero-gap cells and PEM/AEM hardware test a full membrane electrode assembly." },
      { term: "Watching the reaction", text: "Transparent bodies show bubble behaviour; quartz windows admit light for photo-assisted work." },
    ],
    faqs: [
      {
        q: "What is a zero-gap electrolyzer?",
        a: "One where the electrodes press directly against the membrane, with no electrolyte gap between them. This cuts ohmic resistance, so the cell runs at higher current density for the same voltage.",
      },
    ],
    related: ["pem-membranes", "aem-membranes", "carbon-gdl", "peristaltic-pumps", "photo-ec-reactors"],
    keywords: ["PEM electrolyzer", "PEM electrolyzer price", "water electrolysis cell", "zero gap electrolyzer", "AEM electrolyzer", "water splitting reactor"],
  },

  "co2-electrolysis": {
    title: "CO₂ Electrolyzers & Gas Diffusion Flow Cells, India",
    h1: "CO₂ Electrolyzers and Gas Diffusion Flow Cells",
    lead: "CO₂ reduction flow cells, zero-gap electrolyzers and in situ Raman cells.",
    nouns: "CO₂ electrolysis cells",
    intro:
      "CO₂ electrolysis turns carbon dioxide into products such as carbon monoxide, formate and ethylene at a catalyst-coated electrode. METNMAT sells gas diffusion flow cells in PTFE, PEEK and transparent bodies, flow electrolyzers, a zero-gap electrolyzer, and in situ Raman cells for watching the reaction as it runs.",
    guideTitle: "How to choose a CO₂ reduction cell",
    guide: [
      { term: "Gas diffusion flow cell", text: "Feeds CO₂ gas straight to a gas diffusion electrode, for higher current density than an H-cell." },
      { term: "Zero-gap electrolyzer", text: "Presses the electrodes against the membrane, for device-level testing." },
      { term: "PTFE or PEEK body", text: "PTFE is the most inert. PEEK is stiffer and seals well under clamping." },
      { term: "In situ Raman cell", text: "Has an optical window for studying the catalyst while it works." },
    ],
    faqs: [
      {
        q: "Why use a gas diffusion flow cell for CO₂ reduction?",
        a: "CO₂ dissolves poorly in water, which limits the current in an H-cell. A gas diffusion electrode brings CO₂ gas directly to the catalyst, so far higher current densities are possible.",
      },
    ],
    related: ["h-cell", "aem-membranes", "carbon-gdl", "peristaltic-pumps", "water-splitting-reactors"],
    keywords: ["CO2 electrolyzer", "CO2 reduction flow cell", "gas diffusion flow cell", "CO2RR cell", "in situ Raman electrochemical cell"],
  },

  "fuel-cells": {
    title: "PEM & Microbial Fuel Cell Hardware, Price in India",
    h1: "Fuel Cell Hardware and Reactors",
    lead: "PEM fuel cell hardware, microbial fuel cell reactors and a vanadium flow cell reactor.",
    nouns: "fuel cell reactors",
    intro:
      "Fuel cell hardware holds a membrane electrode assembly or a biological anode so that its power output can be tested. METNMAT sells research-scale PEM fuel cell hardware, microbial fuel cell (MFC) reactors and stacks, and a transparent vanadium flow cell reactor.",
    guideTitle: "Which reactor fits your work?",
    guide: [
      { term: "PEM fuel cell hardware", text: "Single-cell hardware for testing membrane electrode assemblies." },
      { term: "Microbial fuel cell", text: "For bioelectricity and wastewater research." },
      { term: "Vanadium flow cell", text: "For vanadium redox flow battery research." },
    ],
    faqs: [
      {
        q: "What is a microbial fuel cell?",
        a: "A cell in which bacteria on the anode oxidise organic matter and pass electrons to the electrode, generating electricity directly from waste or other organic feeds.",
      },
    ],
    related: ["pem-membranes", "carbon-gdl", "specialised-equipment", "mea-fabrication"],
    keywords: ["PEM fuel cell hardware", "microbial fuel cell", "microbial fuel cell kit", "fuel cell test hardware India", "vanadium flow cell"],
  },

  "battery-reactors": {
    title: "Swagelok Battery Test Cells & Metal-Air Reactors",
    h1: "Battery Test Cells and Reactors",
    lead: "Swagelok-type battery test cells, metal-air and metal-flow battery reactors.",
    nouns: "battery test cells",
    intro:
      "A battery test cell lets you evaluate electrodes, electrolytes and separators without building a full battery. METNMAT sells reusable Swagelok-type cells in PTFE and PEEK, plus metal-air and metal-flow battery reactors.",
    guideTitle: "Which battery cell do you need?",
    guide: [
      { term: "Swagelok-type cell", text: "A reusable two-electrode compression cell for fast material screening." },
      { term: "PTFE or PEEK body", text: "PEEK is the stiffer body; PTFE is the most chemically inert." },
      { term: "Metal-air reactor", text: "An air-breathing cell for metal-air chemistries." },
      { term: "Metal-flow reactor", text: "A flow platform for flow battery development." },
    ],
    faqs: [
      {
        q: "What is a Swagelok cell?",
        a: "A reusable compression cell that holds an electrode, separator and counter electrode between two plungers. It can be opened, cleaned and refilled, which makes it faster than building coin cells for early screening.",
      },
    ],
    related: ["reactor-cell", "fuel-cells", "specialised-equipment", "carbon-gdl"],
    keywords: ["Swagelok cell", "battery test cell", "battery test fixture", "metal air battery reactor", "Swagelok type cell"],
  },

  "photo-ec-reactors": {
    title: "Photoelectrochemical Cells & PEC Reactors, India",
    h1: "Photoelectrochemical (PEC) Cells and Reactors",
    lead: "Photoelectrochemical cells and panel reactors for solar water splitting research.",
    nouns: "photoelectrochemical reactors",
    intro:
      "A photoelectrochemical (PEC) cell lets light reach an electrode so that sunlight can drive reactions such as water splitting. METNMAT sells a three-electrode PTFE PEC cell for quantum efficiency work, a PV-biased PEC cell, and the APP-400 photocatalytic panel reactor.",
    guideTitle: "Which PEC cell fits your work?",
    guide: [
      { term: "Three-electrode PEC cell", text: "For measuring a photoelectrode under controlled potential." },
      { term: "PV-biased cell", text: "Adds a photovoltaic bias to the photoelectrode." },
      { term: "Panel reactor", text: "For photocatalytic water splitting on a panel." },
    ],
    faqs: [
      {
        q: "What is a photoelectrochemical cell?",
        a: "An electrochemical cell with a light-absorbing electrode. Light creates charge carriers in the electrode, and they drive a reaction such as splitting water into hydrogen and oxygen.",
      },
    ],
    related: ["water-splitting-reactors", "reference-electrodes", "co2-electrolysis"],
    keywords: ["photoelectrochemical cell", "PEC cell", "photocatalytic reactor", "solar water splitting reactor"],
  },

  "peristaltic-pumps": {
    title: "Peristaltic Pumps for Labs: Price in India",
    h1: "Laboratory Peristaltic Pumps",
    lead: "Single-channel, dual-channel and Wi-Fi touchscreen peristaltic pumps, including Kamoer.",
    nouns: "peristaltic pumps",
    intro:
      "A peristaltic pump moves liquid by squeezing a flexible tube, so the liquid touches only the tube. That makes it a good fit for circulating electrolyte through flow cells and electrolyzers. METNMAT sells compact knob-controlled pumps, dispensing pumps, and single and dual-channel intelligent pumps, including Kamoer models.",
    guideTitle: "How to choose a peristaltic pump",
    guide: [
      { term: "Flow rate", text: "Check the model's rated flow against the volume you need to circulate." },
      { term: "Channels", text: "A dual-channel pump feeds anode and cathode sides from one unit." },
      { term: "Control", text: "Knob control suits simple circulation; touchscreen and Wi-Fi models suit programmed runs and dispensing." },
      { term: "Tubing", text: "Choose a tube material that resists your electrolyte." },
    ],
    faqs: [
      {
        q: "Why use a peristaltic pump with corrosive electrolytes?",
        a: "The liquid stays inside the tube and never touches the pump's metal parts, so there is no contamination and no corrosion of the pump, as long as the tube suits the chemical.",
      },
    ],
    related: ["co2-electrolysis", "water-splitting-reactors", "battery-reactors", "fuel-cells"],
    keywords: ["peristaltic pump", "peristaltic pump price India", "laboratory peristaltic pump", "dual channel peristaltic pump", "Kamoer peristaltic pump", "dosing pump"],
  },

  "carbon-gdl": {
    title: "GDL Carbon Paper, Nickel Foam & Carbon Cloth, India",
    h1: "Gas Diffusion Layers, Carbon Materials and Metal Foams",
    lead: "GDL carbon paper, carbon cloth, graphite felt, nickel foam, nickel felt and copper foam.",
    nouns: "carbon and foam electrode materials",
    intro:
      "Porous electrode materials give a reaction more surface and let gas and liquid reach the catalyst. METNMAT sells gas diffusion layer (GDL) carbon paper, carbon fibre cloth, graphite felt, nickel foam, nickel fibre felt and copper foam, in sheet sizes for lab cells.",
    guideTitle: "How to choose a porous electrode material",
    guide: [
      { term: "GDL carbon paper", text: "Stiff and thin, for fuel cells, electrolyzers and CO₂ flow cells." },
      { term: "Carbon cloth", text: "Flexible and conductive, and easy to cut to shape." },
      { term: "Graphite felt", text: "Thick and porous, common in flow batteries." },
      { term: "Nickel foam", text: "A conductive open-cell support for alkaline electrolysis and catalyst growth." },
      { term: "Nickel felt", text: "A sintered fibre sheet with finer pores than foam." },
    ],
    faqs: [
      {
        q: "What is a gas diffusion layer?",
        a: "A porous, conductive sheet between the catalyst and the flow field. It spreads gas evenly across the catalyst, carries electrons and helps remove water.",
      },
      {
        q: "What does PPI mean for nickel foam?",
        a: "Pores per inch. A higher PPI means smaller, more numerous pores and more surface area. METNMAT's nickel foam is 110 PPI, 1.5 mm thick.",
      },
    ],
    related: ["co2-electrolysis", "water-splitting-reactors", "fuel-cells", "consumables"],
    keywords: ["nickel foam", "nickel foam price", "nickel foam electrode", "GDL carbon paper", "gas diffusion layer", "carbon cloth", "graphite felt", "copper foam"],
  },

  consumables: {
    title: "Ionomer Dispersions: PFSA, Fumion, PiperION, India",
    h1: "Ionomer Dispersions and Consumables",
    lead: "PFSA, Fumion FAA-3 and PiperION ionomer dispersions for catalyst inks.",
    nouns: "ionomer dispersions",
    intro:
      "An ionomer dispersion is an ion-conducting polymer in liquid form. It binds a catalyst layer together and carries ions to the catalyst. METNMAT sells PFSA resin dispersion, FUMATECH Fumion FAA-3-SOLUT-10 and Versogen PiperION dispersion.",
    guideTitle: "How to choose an ionomer",
    guide: [
      { term: "Proton-conducting systems", text: "PFSA dispersion, with a PEM." },
      { term: "Anion-conducting systems", text: "Fumion or PiperION, with an AEM." },
      { term: "Rule of thumb", text: "Match the ionomer to the membrane so that ions move through one continuous phase." },
    ],
    faqs: [
      {
        q: "What does an ionomer do in a catalyst ink?",
        a: "It binds the catalyst particles to the electrode and gives them an ion-conducting path. Without it, much of the catalyst would be cut off from the reaction.",
      },
    ],
    related: ["pem-membranes", "aem-membranes", "carbon-gdl", "working-electrodes"],
    keywords: ["ionomer dispersion", "PFSA dispersion", "Fumion FAA-3", "PiperION ionomer", "anion exchange ionomer"],
  },

  equipments: {
    title: "Lab Equipment for Electrochemistry & MEA Making",
    h1: "Electrochemistry Lab Equipment",
    lead: "Peristaltic pumps, MEA presses, fuel cell test stations and lab accessories.",
    nouns: "lab equipment",
    intro:
      "Beyond the cell itself, an electrochemistry lab needs pumps, presses, heaters and test stations. METNMAT sells peristaltic pumps, MEA hot presses and hydraulic presses, fuel cell test equipment, temperature controllers and accessories.",
    guideTitle: "What this range covers",
    guide: [
      { term: "MEA fabrication", text: "Hydraulic and hot presses for making membrane electrode assemblies." },
      { term: "Research equipment", text: "Fuel cell test stations and temperature control." },
      { term: "Accessories", text: "Metal sheets, gas sampling bags and materials." },
    ],
    faqs: [],
    related: ["mea-fabrication", "specialised-equipment", "peristaltic-pumps", "accessories"],
    keywords: ["electrochemistry lab equipment", "lab equipment India"],
  },

  "specialised-equipment": {
    title: "Fuel Cell Test Station & Research Equipment, India",
    h1: "Specialised Research Equipment",
    lead: "Fuel cell test stations, a fuel cell and metal-air battery tester and heating control.",
    nouns: "research equipment",
    intro:
      "This range covers the test systems around a cell. METNMAT sells a fuel cell test station, a 400 W fuel cell and metal-air battery testing device, a PID temperature controlling unit that reaches 200 °C, and a triboelectric measurement setup.",
    guideTitle: "What each system is for",
    guide: [
      { term: "Fuel cell test station", text: "For performance and durability testing of fuel cells." },
      { term: "400 W testing device", text: "For testing fuel cells and metal-air batteries." },
      { term: "Temperature controlling unit", text: "A PID heating plate for holding a cell at temperature." },
      { term: "Triboelectric setup", text: "For characterising triboelectric materials." },
    ],
    faqs: [],
    related: ["fuel-cells", "battery-reactors", "mea-fabrication"],
    keywords: ["fuel cell test station", "fuel cell testing equipment India", "triboelectric measurement setup"],
  },

  "mea-fabrication": {
    title: "Hot Press & Hydraulic Press for MEA Making, India",
    h1: "MEA Fabrication Presses",
    lead: "20 and 30 ton hydraulic presses and an MEA hot press for membrane electrode assemblies.",
    nouns: "MEA presses",
    intro:
      "A membrane electrode assembly (MEA) is made by pressing electrodes onto a membrane, often with heat, so that the layers bond. METNMAT sells the MHP-20 and MHP-30 four-pillar hydraulic presses and the MEA Thermopress 2000 hydraulic hot press.",
    guideTitle: "How to choose a press",
    guide: [
      { term: "Hot press", text: "Applies heat and pressure together, which bonding an MEA normally needs." },
      { term: "Hydraulic press", text: "Applies pressure alone, for lamination and electrode pressing." },
      { term: "Tonnage", text: "Choose the capacity from the pressure you need and your sample area." },
    ],
    faqs: [
      {
        q: "What is a membrane electrode assembly?",
        a: "The core of a PEM or AEM fuel cell or electrolyzer: a membrane with catalyst layers and usually gas diffusion layers bonded to both sides.",
      },
    ],
    related: ["pem-membranes", "carbon-gdl", "fuel-cells", "consumables"],
    keywords: ["MEA hot press", "hot press machine", "hydraulic press machine", "30 ton hydraulic press", "membrane electrode assembly press"],
  },

  accessories: {
    title: "Zinc Sheet, Aluminium Sheet & Lab Accessories, India",
    h1: "Metal Sheets and Lab Accessories",
    lead: "High-purity zinc sheet, aluminium sheet, gas sampling bags and MnO₂ nanoparticles.",
    nouns: "accessories",
    intro:
      "This range covers the materials and small items that support electrochemistry work. METNMAT sells high-purity zinc sheet (99.99% to 99.995%), aluminium sheet (at least 99.8%), 1 litre gas sampling bags with a PTFE valve, and manganese dioxide nanoparticles.",
    guideTitle: "What these are used for",
    guide: [
      { term: "Zinc sheet", text: "An anode material for zinc-air and zinc-ion battery research." },
      { term: "Aluminium sheet", text: "For electrode work, fabrication and research." },
      { term: "Gas sampling bag", text: "For collecting gas products from a cell for later analysis." },
    ],
    faqs: [],
    related: ["battery-reactors", "co2-electrolysis", "consumables"],
    keywords: ["zinc sheet", "pure zinc sheet", "high purity zinc sheet", "aluminium sheet", "gas sampling bag", "manganese dioxide nanoparticles"],
  },
};

/** What the page can truthfully say about price: only products with a listed price count. */
export function categoryPriceFacts(products: Product[]) {
  const prices = products
    .filter((p) => p.price > 0 && !isQuoteOnly(p))
    .map((p) => inclGSTForProduct(p, p.price));
  return { count: products.length, min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
}

export function categoryMetaDescription(seo: CategorySeo, products: Product[]): string {
  const { count, min } = categoryPriceFacts(products);
  const price = min ? ` ${count} products from ${formatINR(min)} incl. GST.` : "";
  return `${seo.lead}${price} Free shipping in India.`;
}

/**
 * The price question buyers ask, answered from the live catalogue, followed by the
 * written FAQs. Left out when nothing in the category has a price.
 */
export function categoryFaqs(seo: CategorySeo, products: Product[]): { q: string; a: string }[] {
  const { min, max } = categoryPriceFacts(products);
  if (!min) return seo.faqs;
  const range = min === max ? formatINR(min) : `${formatINR(min)} to ${formatINR(max)}`;
  return [
    {
      q: `What is the price of ${seo.nouns} in India?`,
      a: `Prices for METNMAT's ${seo.nouns} run ${range} including GST, with free shipping within India and a GST invoice. Each product page shows its exact price.`,
    },
    ...seo.faqs,
  ];
}
