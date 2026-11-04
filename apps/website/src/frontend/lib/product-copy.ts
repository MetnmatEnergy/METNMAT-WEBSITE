import { productSearchTerms } from "@/frontend/lib/product-terms";

/**
 * The written content of a product page, by product family.
 *
 * All 141 products have a short description and no long one, and Search Console
 * lists 37 pages as "Crawled - currently not indexed": Google visited and judged
 * them thin. This says what the thing is, what it is for and how to look after
 * it, which is what a buyer needs and what a page needs to be worth indexing.
 *
 * Standard electrochemistry only. Nothing here may state a size, stock level,
 * delivery time, certification or performance figure for a METNMAT product:
 * those come from the product's own fields. Keys are the first search term of a
 * family (product-terms.ts), and test/product-copy.test.ts requires one for every
 * product in the catalogue.
 */
export type ProductCopy = {
  /** Opens with what it is, in the buyer's words. */
  about: string;
  uses: string[];
  care: string[];
};

const PLATINUM_CARE = [
  "Rinse with deionised water after each use, and clean by your protocol before critical measurements.",
  "Handle thin wire, mesh and foil gently: platinum is soft and bends easily.",
];
const HOLDER_COPY: ProductCopy = {
  about:
    "An electrode holder clamps a flat sample and connects it to the potentiostat, so a plate, foil or coated sheet can act as the working electrode without soldering a wire to it. The body keeps the contact out of the electrolyte, so only the sample surface takes part in the reaction.",
  uses: ["Testing coated plates, foils and sheets as working electrodes", "Comparing samples quickly without rewiring", "Catalyst and corrosion studies on flat samples"],
  care: ["Rinse after each run so that electrolyte does not creep to the contact.", "Do not overtighten: PTFE is soft, and a stripped clamp loses its grip."],
};
const PUMP_COPY = (about: string): ProductCopy => ({
  about,
  uses: ["Circulating electrolyte through flow cells and electrolyzers", "Feeding reagents at a steady rate", "Transferring liquids without contaminating them"],
  care: ["Choose a tube material that resists your electrolyte, and replace it when it wears.", "Release the tube when the pump stands idle for long, so that it does not take a set."],
});
const MEMBRANE_CARE = [
  "Handle with clean gloves, and keep it flat and away from dust.",
  "Follow the maker's instructions for conditioning before first use.",
];
const ELECTROLYZER_CARE = [
  "Tighten the clamping bolts evenly, in a cross pattern, to the torque your setup needs.",
  "Flush with deionised water after use, and check seals before each run.",
];
const IONOMER_CARE = ["Keep the bottle sealed and store it as the maker directs.", "Mix gently before use, and record the amount used in each ink."];

export const PRODUCT_COPY: Record<string, ProductCopy> = {
  // ── Reference electrodes
  "Hg/HgO reference electrode": {
    about:
      "An Hg/HgO reference electrode, also written HgO or mercury oxide electrode, is the usual reference for alkaline electrolytes such as KOH and NaOH. Its reaction involves hydroxide ions, so it stays stable where other references drift, and it leaks no chloride into the cell.",
    uses: ["Alkaline water electrolysis and AEM studies", "HER and OER catalyst testing in KOH", "Battery and fuel cell research in alkaline media"],
    care: ["Keep the tip wet in its filling solution and never let it dry out.", "It contains mercury: follow your lab's rules for storage, breakage and disposal."],
  },
  "Ag/AgCl reference electrode": {
    about:
      "An Ag/AgCl reference electrode, also called a silver chloride electrode, is a silver wire coated with silver chloride in a chloride solution, usually KCl. It is one of the most widely used references in electrochemistry because it is stable, simple and free of mercury.",
    uses: ["Cyclic voltammetry and general three-electrode work", "Corrosion and sensor studies in neutral or acidic solutions", "Catalyst testing, with potentials converted to RHE"],
    care: ["Store with the tip in its filling solution, in the dark, and never let it dry out.", "Check it against a fresh reference from time to time: a drift of a few millivolts means it needs attention."],
  },
  "saturated calomel electrode": {
    about:
      "A saturated calomel electrode (SCE) is a mercury/mercurous chloride reference in saturated KCl, sitting at about +0.241 V against the standard hydrogen electrode at 25 °C. It is a classic reference with a very stable potential for aqueous work.",
    uses: ["Corrosion testing, where SCE is a common reporting scale", "Aqueous electrochemistry in neutral and acidic solutions", "Comparing results with older published data"],
    care: ["Keep it upright with the tip wet, and top up the KCl.", "It contains mercury: follow your lab's rules for storage, breakage and disposal."],
  },
  "mercurous sulfate reference electrode": {
    about:
      "A mercurous sulfate reference electrode, Hg/Hg₂SO₄, uses a sulfate solution in place of chloride, so it leaks no chloride into the cell. That makes it the usual choice for sulfuric acid electrolytes and for work on metals that chloride would attack.",
    uses: ["Sulfuric acid electrolytes, including lead-acid and PEM studies", "Chloride-sensitive corrosion work", "Catalyst testing in acid"],
    care: ["Keep the tip wet in its filling solution.", "It contains mercury: follow your lab's rules for storage, breakage and disposal."],
  },
  "Ag/Ag+ reference electrode": {
    about:
      "An Ag/Ag⁺ reference electrode is a non-aqueous reference: a silver wire in a silver salt solution in an organic solvent. It avoids bringing water and chloride into organic electrolytes, where aqueous references would contaminate the cell.",
    uses: ["Electrochemistry in acetonitrile and other organic solvents", "Non-aqueous battery electrolyte studies", "Organic electrosynthesis"],
    care: ["Prepare the filling solution with the same solvent and supporting salt as the cell.", "Report potentials against an internal standard such as ferrocene, since the value depends on the solvent."],
  },

  // ── Holders
  "electrode holder": HOLDER_COPY,
  "platinum electrode holder": HOLDER_COPY,
  "titanium electrode holder": HOLDER_COPY,
  "copper electrode holder": HOLDER_COPY,
  "crocodile clip electrode holder": HOLDER_COPY,
  "glassy carbon electrode holder": {
    about:
      "A glassy carbon electrode holder grips a glassy carbon sample and makes the electrical contact, so the sample can be used as a working electrode in a standard cell. The slit width sets the thickness of sample it accepts.",
    uses: ["Using glassy carbon plates as working electrodes", "Catalyst screening on replaceable samples", "Cells that need a rigid PEEK body"],
    care: ["Match the slit width to your sample thickness.", "Rinse after each run so that electrolyte does not reach the contact."],
  },

  // ── Metal and carbon electrodes
  "gold wire electrode": {
    about:
      "A gold wire electrode is a counter electrode made of gold, used where gold is preferred to platinum. The ring shape gives an even current path around the working electrode.",
    uses: ["Counter electrode in sensing work", "Cells where platinum must be avoided", "Studies of gold surfaces"],
    care: ["Rinse with deionised water after each use.", "Handle gently: gold wire is soft."],
  },
  "gold disk electrode": {
    about:
      "A gold disk electrode is a working electrode with a polished, conductive gold surface of known area. Gold bonds readily to thiols, which makes it a common choice for sensors and modified surfaces.",
    uses: ["Electrochemical sensors and biosensors", "Self-assembled monolayer studies", "Electrocatalysis on a clean gold surface"],
    care: ["Polish with alumina slurry and rinse well before use.", "Avoid scratching the disk: surface quality decides how repeatable your results are."],
  },
  "platinum disk electrode": {
    about:
      "A platinum disk electrode is a working electrode with a polished platinum surface of known area, so measured current converts directly to current density. Platinum is the standard surface for hydrogen and oxygen reaction studies.",
    uses: ["Hydrogen and oxygen reaction studies", "Alcohol oxidation and fuel cell catalyst work", "Teaching and method development"],
    care: ["Polish with alumina slurry and rinse well before use.", "Clean by potential cycling in dilute acid if your protocol calls for it."],
  },
  "platinum ring electrode": {
    about:
      "A platinum ring electrode is a counter electrode of platinum wire formed into a ring. The ring surrounds the working electrode, which spreads the current evenly, and platinum stays inert in most electrolytes.",
    uses: ["Counter electrode in three-electrode cells", "Cells that need even current around the sample", "Work in acid and alkaline solutions"],
    care: PLATINUM_CARE,
  },
  "platinum spiral electrode": {
    about:
      "A platinum spiral electrode is a counter electrode of platinum wire wound into a coil. The coil packs a long length of wire, and so more surface, into a small space.",
    uses: ["Counter electrode where a large area must fit a narrow port", "Three-electrode cells in acid and alkaline solutions", "General electrochemistry"],
    care: PLATINUM_CARE,
  },
  "platinum mesh electrode": {
    about:
      "A platinum mesh electrode is a woven platinum counter electrode. It offers a large surface for its size, and its open structure lets gas bubbles and electrolyte pass through, so it does not limit the current.",
    uses: ["Counter electrode for high-current work", "Electrolysis, where gas must escape freely", "Three-electrode cells in acid and alkaline solutions"],
    care: PLATINUM_CARE,
  },
  "platinum wire electrode": {
    about:
      "A platinum wire electrode, or Pt wire electrode, is the simplest platinum counter electrode: a length of platinum wire on a rod. It fits narrow ports and stays inert in most electrolytes.",
    uses: ["Counter or auxiliary electrode in small cells", "Pseudo-reference electrode in non-aqueous work", "General voltammetry"],
    care: PLATINUM_CARE,
  },
  "platinum sheet electrode": {
    about:
      "A platinum sheet electrode, also called a platinum plate or foil electrode, is a flat platinum electrode with a known area. It is used as a counter electrode, and as a clean, flat platinum surface for electrode studies.",
    uses: ["Counter electrode with a defined area", "Flat platinum surface for catalyst and deposition work", "Electrochemistry in acid and alkaline solutions"],
    care: PLATINUM_CARE,
  },
  "platinum counter electrode": {
    about:
      "A platinum counter electrode, also called an auxiliary electrode, carries the current in a three-electrode cell so that the reference electrode stays undisturbed. Platinum is the usual choice because it stays inert in most electrolytes.",
    uses: ["Counter electrode in three-electrode cells", "Cyclic voltammetry and corrosion testing", "General electrochemistry in acid and alkaline solutions"],
    care: PLATINUM_CARE,
  },
  "graphite rod electrode": {
    about:
      "A graphite rod electrode is a conductive carbon rod, used mostly as a counter electrode. It costs far less than platinum and adds no metal to the cell, so it is the safer choice for hydrogen evolution catalyst studies.",
    uses: ["Counter electrode for HER and OER catalyst testing", "Low-cost electrolysis setups", "Teaching laboratories"],
    care: ["Rinse after use and let it dry fully: graphite is porous and holds electrolyte.", "Replace it if the surface starts to shed particles."],
  },
  "graphite plate electrode": {
    about:
      "A graphite plate electrode is a flat, conductive carbon electrode with a known area. It suits work where a flat surface or a low-cost, metal-free counter electrode is needed.",
    uses: ["Counter electrode with a defined area", "Metal-free electrolysis setups", "Flat carbon substrate for coatings"],
    care: ["Rinse after use and let it dry fully: graphite is porous.", "Handle with care, as graphite plates are brittle."],
  },
  "glassy carbon electrode": {
    about:
      "A glassy carbon electrode (GCE) is a working electrode of hard, non-porous carbon with a wide potential window and a low background current. It is the usual surface for testing catalyst inks and for general voltammetry.",
    uses: ["Testing catalyst inks for HER, OER and ORR", "Cyclic voltammetry and sensor work", "Rotating and static electrode studies"],
    care: ["Polish with alumina slurry on a pad before each run, and rinse well.", "Never touch the polished disk, and store it dry and protected."],
  },
  "titanium felt": {
    about:
      "Titanium felt, or Ti felt, is a porous sheet of sintered titanium fibres. It conducts well, resists corrosion and lets water and gas pass, so it is used as a porous layer in PEM electrolyzers and as a corrosion-resistant electrode support.",
    uses: ["Porous layer on the anode side of PEM electrolyzers", "Corrosion-resistant electrode support", "Catalyst coating substrate"],
    care: ["Cut with sharp tools, to avoid crushing the pores.", "Clean by your protocol before coating."],
  },

  // ── Porous materials
  "nickel felt": {
    about:
      "Nickel felt, also called nickel fiber felt, is a porous sheet of sintered nickel fibres with finer pores than nickel foam. It conducts well and stands up to alkaline conditions, so it is used in alkaline electrolyzers and as an electrode support.",
    uses: ["Alkaline water electrolysis", "Electrode and catalyst support", "Battery and fuel cell research"],
    care: ["Cut with sharp tools, to avoid crushing the pores.", "Clean off surface oxide by your protocol before coating."],
  },
  "nickel foam": {
    about:
      "Nickel foam, or Ni foam, is a porous, conductive nickel sheet with an open-cell structure and a very high surface area. It is one of the most common supports for growing catalysts, and for electrodes in alkaline electrolysis and batteries.",
    uses: ["Support for growing HER and OER catalysts", "Alkaline water electrolysis electrodes", "Battery and supercapacitor electrodes"],
    care: ["Clean off the surface oxide before use, commonly by sonicating in dilute acid.", "Cut to size with scissors, and avoid crushing it."],
  },
  "graphite felt": {
    about:
      "Graphite felt is a thick, porous carbon sheet with a large surface area and good chemical resistance. It is the common electrode in flow batteries, and it is used wherever electrolyte must flow through the electrode.",
    uses: ["Redox flow battery electrodes", "Bioelectrochemical and microbial fuel cell anodes", "Flow-through electrodes"],
    care: ["Cut to size and compress it as your cell design requires.", "Many protocols heat-treat it before use to improve wetting."],
  },
  "carbon cloth": {
    about:
      "Carbon cloth is a woven, conductive fabric of carbon fibres. It is flexible and easy to cut, so it is used as an electrode support and as a gas diffusion layer in fuel cells and electrolyzers.",
    uses: ["Flexible electrode substrate", "Gas diffusion layer in fuel cells", "Catalyst support and microbial fuel cell anodes"],
    care: ["Cut with sharp scissors to avoid fraying.", "Keep it clean and dry until use."],
  },
  "copper foam": {
    about:
      "Copper foam is a porous, conductive copper sheet with an open-cell structure. It offers a high surface area and good conductivity, which makes it a useful support for electrodes and for CO₂ reduction catalysts.",
    uses: ["Electrode support for CO₂ reduction research", "Battery current collector studies", "Heat transfer and catalyst support"],
    care: ["Copper oxidises in air: clean the surface by your protocol before use.", "Cut to size with care, to avoid crushing it."],
  },
  "carbon paper": {
    about:
      "GDL carbon paper is a stiff, porous, conductive sheet of carbon fibres. As a gas diffusion layer, it spreads gas evenly across the catalyst, carries electrons and helps remove water in fuel cells and electrolyzers.",
    uses: ["Gas diffusion electrodes for CO₂ electrolysis", "PEM fuel cell gas diffusion layers", "Catalyst-coated electrode substrate"],
    care: ["Handle by the edges and do not bend it: it is brittle.", "Keep it dry and flat until use."],
  },

  // ── Cells and reactors
  "in situ Raman electrochemical cell": {
    about:
      "An in situ Raman electrochemical cell has an optical window, so a Raman spectrometer can observe an electrode while it reacts. It shows what is on the catalyst surface during the reaction, which ordinary measurements cannot.",
    uses: ["Operando study of catalyst surfaces", "CO₂ reduction and water splitting mechanisms", "Identifying reaction intermediates"],
    care: ["Keep the window clean and free of scratches.", "Check seals before each run, and align the laser with care."],
  },
  "zero gap CO2 electrolyzer": {
    about:
      "A zero gap CO₂ electrolyzer presses the electrodes against the membrane, with no liquid gap between them. This cuts resistance, so the cell runs at higher current for the same voltage, and it is the design closest to a practical device.",
    uses: ["Device-level CO₂ electrolysis testing", "Testing membrane electrode assemblies", "Scale-up studies"],
    care: ELECTROLYZER_CARE,
  },
  "CO2 reduction flow cell": {
    about:
      "A CO₂ reduction flow cell feeds CO₂ gas through a gas diffusion electrode, straight to the catalyst. CO₂ dissolves poorly in water, which limits an H-cell, so a flow cell reaches far higher current densities.",
    uses: ["CO₂ electroreduction at high current density", "Testing gas diffusion electrodes", "Comparing catalysts under practical conditions"],
    care: ELECTROLYZER_CARE,
  },
  "zero gap electrolyzer": {
    about:
      "A zero gap electrolyzer presses the electrodes directly against the membrane, with no electrolyte gap between them. This lowers the cell's resistance, so it runs at higher current density for the same voltage.",
    uses: ["Water electrolysis research", "Testing membrane electrode assemblies", "Comparing catalysts at device level"],
    care: ELECTROLYZER_CARE,
  },
  "H-cell": {
    about:
      "An H-cell is a two-chamber electrochemical cell, shaped like the letter H, with a membrane in the bridge between the chambers. The membrane lets ions pass but keeps the products of each electrode apart.",
    uses: ["CO₂ reduction and electrosynthesis", "Catalyst screening with separated products", "Studies needing separate anode and cathode electrolytes"],
    care: ["Choose a membrane for your electrolyte, and check that the bridge seals well.", "Purge with gas before starting if your reaction is air-sensitive."],
  },
  "water jacketed electrochemical cell": {
    about:
      "A water jacketed electrochemical cell has an outer jacket that circulates water from a thermostat bath, holding the electrolyte at a set temperature. Temperature changes reaction rates and potentials, so this makes results repeatable.",
    uses: ["Temperature-controlled three-electrode studies", "Corrosion testing at set temperatures", "Kinetics and activation energy measurements"],
    care: ["Connect the jacket to a circulator before filling the cell.", "Handle glass joints with care, and rinse well between runs."],
  },
  "electrochemical cell": {
    about:
      "A single-chamber electrochemical cell is the basic vessel for three-electrode work: one compartment holding the working, reference and counter electrodes in the same electrolyte. It is the simplest and most widely used setup.",
    uses: ["Cyclic voltammetry and general electrochemistry", "Catalyst and sensor testing", "Teaching laboratories"],
    care: ["Clean thoroughly between runs, as traces of old electrolyte affect results.", "Handle glass joints with care."],
  },
  "electrowinning cell": {
    about:
      "An electrowinning cell recovers a metal from solution by plating it onto a cathode. A lab system lets you study the process, the electrolyte and the electrodes before scaling up.",
    uses: ["Metal recovery research", "Hydrometallurgy process development", "Electrode and electrolyte testing"],
    care: ["Keep electrode spacing consistent between runs.", "Handle electrolytes and any fumes under your lab's safety rules."],
  },
  "PEM electrolyzer": {
    about:
      "A PEM electrolyzer splits water into hydrogen and oxygen across a proton exchange membrane. It needs only pure water as a feed, and it produces hydrogen cleanly, which makes it a popular lab source and research platform.",
    uses: ["Hydrogen generation in the lab", "Teaching water electrolysis", "PEM research"],
    care: ["Use deionised water only: ions in tap water damage the membrane.", "Vent hydrogen safely, and keep it away from ignition sources."],
  },
  "PEM electrolyzer hardware": {
    about:
      "PEM and AEM electrolyzer hardware is a test cell that holds a membrane electrode assembly between flow fields, for measuring how a membrane and catalysts perform as a working device.",
    uses: ["Testing membrane electrode assemblies", "Durability studies", "Comparing PEM and AEM materials"],
    care: ELECTROLYZER_CARE,
  },
  "electrolyzer test cell": {
    about:
      "An electrolyzer test cell holds a small membrane electrode assembly between flow fields, so a new catalyst or membrane can be tested at device level with little material.",
    uses: ["Testing new catalysts and membranes", "PEM and AEM electrolysis research", "Polarisation and durability measurements"],
    care: ELECTROLYZER_CARE,
  },
  "photoelectrochemical water splitting cell": {
    about:
      "A photoelectrochemical water splitting cell has a quartz window that lets light reach the electrode, so sunlight can help drive water splitting. Quartz is used because it passes ultraviolet light, which ordinary glass blocks.",
    uses: ["Solar water splitting research", "Testing photoelectrodes", "Light-assisted electrolysis"],
    care: ["Keep the quartz window clean and free of scratches.", "Check seals before each run."],
  },
  "photocatalytic reactor": {
    about:
      "A photocatalytic reactor exposes a catalyst to light so that it drives a reaction, such as splitting water into hydrogen and oxygen, without any external electrodes. A panel design spreads the catalyst over a large lit area.",
    uses: ["Solar hydrogen research", "Testing photocatalyst panels", "Gas evolution measurements"],
    care: ["Keep the light-facing surface clean.", "Check seals before collecting gas samples."],
  },
  "water splitting reactor": {
    about:
      "A water splitting reactor holds the electrodes and electrolyte for splitting water into hydrogen and oxygen, so that catalysts and conditions can be tested. Designs vary in body material, chamber layout and how the gases are collected.",
    uses: ["HER and OER catalyst testing", "Hydrogen generation studies", "Gas collection and measurement"],
    care: ["Rinse well between runs.", "Vent hydrogen safely, and keep it away from ignition sources."],
  },
  "photoelectrochemical cell": {
    about:
      "A photoelectrochemical (PEC) cell lets light reach a semiconductor electrode, where it creates charge carriers that drive a reaction such as water splitting. It is the main tool for testing photoelectrodes.",
    uses: ["Solar water splitting research", "Photocurrent and quantum efficiency (IPCE) measurements", "Testing photoelectrodes"],
    care: ["Keep the window clean and free of scratches.", "Align your light source the same way each run."],
  },
  "microbial fuel cell": {
    about:
      "A microbial fuel cell generates electricity from bacteria: microbes on the anode break down organic matter and pass electrons to the electrode. It is used to study bioelectricity and wastewater treatment.",
    uses: ["Bioelectricity research", "Wastewater treatment studies", "Teaching bioelectrochemistry"],
    care: ["Clean and sterilise between experiments, as your protocol requires.", "Give the biofilm time to establish before taking measurements."],
  },
  "microbial fuel cell stack": {
    about:
      "A microbial fuel cell stack connects several microbial fuel cells, so that their combined output can be studied. Bacteria on each anode break down organic matter and pass electrons to the electrode.",
    uses: ["Scaling up bioelectricity studies", "Series and parallel connection experiments", "Wastewater treatment research"],
    care: ["Clean and sterilise between experiments, as your protocol requires.", "Give the biofilm time to establish before taking measurements."],
  },
  "PEM fuel cell hardware": {
    about:
      "PEM fuel cell hardware is a single-cell test fixture that clamps a membrane electrode assembly between flow fields and current collectors, so that its performance can be measured.",
    uses: ["Testing membrane electrode assemblies", "Catalyst and membrane research", "Teaching fuel cell operation"],
    care: ["Tighten bolts evenly, to the torque your gaskets need.", "Purge with inert gas after use, and keep the flow fields clean."],
  },
  "vanadium redox flow battery cell": {
    about:
      "A vanadium redox flow battery cell is a lab flow cell for testing vanadium electrolytes, membranes and felt electrodes. Energy is stored in liquid electrolytes that are pumped through the cell.",
    uses: ["Vanadium redox flow battery research", "Testing membranes and graphite felt electrodes", "Electrolyte development"],
    care: ["Flush the cell after use.", "Check seals and pump tubing before each run."],
  },
  "Swagelok cell": {
    about:
      "A Swagelok cell is a reusable compression cell for testing battery materials. It holds an electrode, separator and counter electrode between two plungers, and it can be opened, cleaned and reused, which makes it faster than building coin cells for early screening.",
    uses: ["Screening battery electrodes and electrolytes", "Lithium, sodium and zinc battery research", "Separator testing"],
    care: ["Assemble moisture-sensitive chemistries in a glovebox.", "Clean all parts well between runs, to avoid cross-contamination."],
  },
  "metal air battery test cell": {
    about:
      "A metal-air battery test cell pairs a metal anode with an air-breathing cathode, so that air electrodes, catalysts and electrolytes can be tested. Zinc-air and aluminium-air are the common chemistries.",
    uses: ["Zinc-air and aluminium-air research", "Testing oxygen catalysts", "Air electrode development"],
    care: ["Keep the air side open and dry.", "Rinse parts well after alkaline electrolytes."],
  },
  "flow battery test cell": {
    about:
      "A flow battery test cell circulates electrolyte past its electrodes, so that new chemistries, membranes and electrodes can be tested at lab scale.",
    uses: ["Flow battery development", "Testing membranes and electrodes", "Electrolyte studies"],
    care: ["Flush the cell after use.", "Check seals and pump tubing before each run."],
  },

  // ── Membranes and ionomers
  "PFSA membrane": {
    about:
      "A PFSA membrane is a perfluorosulfonic acid proton exchange membrane: a chemically stable polymer that conducts protons while keeping gases apart. It is the standard membrane for PEM fuel cells and PEM water electrolysis. Thinner grades give lower resistance; thicker ones give less gas crossover.",
    uses: ["PEM fuel cells", "PEM water electrolysis", "Divided electrochemical cells such as H-cells"],
    care: MEMBRANE_CARE,
  },
  "cation exchange membrane": {
    about:
      "A cation exchange membrane carries fixed negative groups, so it passes positive ions and blocks negative ones. It keeps the two sides of a divided cell apart while the circuit stays complete.",
    uses: ["Electrodialysis", "Divided electrochemical cells", "Flow battery research"],
    care: MEMBRANE_CARE,
  },
  "bipolar membrane": {
    about:
      "A bipolar membrane joins a cation exchange layer to an anion exchange layer. Under reverse bias, water splits at the junction into H⁺ and OH⁻, which lets one cell hold a different pH on each side.",
    uses: ["Bipolar membrane electrodialysis", "CO₂ electrolysis research", "Acid and base production from salt"],
    care: MEMBRANE_CARE,
  },
  "Fumasep membrane": {
    about:
      "Fumasep is FUMATECH's family of ion exchange membranes. This anion exchange membrane conducts hydroxide ions, for alkaline electrolysis, CO₂ electrolysis and related research.",
    uses: ["AEM water electrolysis", "CO₂ electrolysis", "Alkaline fuel cells and flow batteries"],
    care: MEMBRANE_CARE,
  },
  "Sustainion membrane": {
    about:
      "Sustainion is Dioxide Materials' anion exchange membrane family, developed for CO₂ electrolysis. It conducts anions and is widely used in CO₂ reduction research.",
    uses: ["CO₂ electrolysis", "AEM water electrolysis research", "Zero-gap electrolyzers"],
    care: MEMBRANE_CARE,
  },
  "PiperION membrane": {
    about:
      "PiperION is Versogen's anion exchange membrane family, based on a poly(aryl piperidinium) polymer. It conducts hydroxide ions, for AEM water electrolysis and fuel cells.",
    uses: ["AEM water electrolysis", "AEM fuel cells", "Alkaline electrochemistry research"],
    care: MEMBRANE_CARE,
  },
  "anion exchange membrane": {
    about:
      "An anion exchange membrane carries fixed positive groups, so it passes negative ions such as hydroxide. That allows alkaline operation, which opens the way to catalysts without platinum-group metals.",
    uses: ["AEM water electrolysis", "Divided electrochemical cells", "Alkaline electrochemistry research"],
    care: MEMBRANE_CARE,
  },
  "PiperION ionomer": {
    about:
      "PiperION ionomer is an anion-conducting polymer dispersion from Versogen. In a catalyst ink, it binds the particles together and carries ions to them, and it pairs with a PiperION membrane.",
    uses: ["AEM catalyst layers", "Gas diffusion electrodes", "MEA fabrication"],
    care: IONOMER_CARE,
  },
  "Fumion ionomer": {
    about:
      "Fumion is FUMATECH's anion exchange ionomer. In a catalyst ink, it binds the particles together and carries ions to them, and it pairs with Fumasep anion exchange membranes.",
    uses: ["AEM catalyst layers", "Gas diffusion electrodes", "MEA fabrication"],
    care: IONOMER_CARE,
  },
  "PFSA dispersion": {
    about:
      "A PFSA dispersion is a perfluorosulfonic acid ionomer in liquid form. In a catalyst ink, it binds the particles together and carries protons to them, and it pairs with PFSA proton exchange membranes.",
    uses: ["PEM catalyst layers", "Catalyst inks on glassy carbon electrodes", "MEA fabrication"],
    care: IONOMER_CARE,
  },

  // ── Pumps
  "Kamoer pump": PUMP_COPY(
    "A Kamoer peristaltic pump is a compact pump for moving small volumes of liquid. It squeezes a flexible tube, so the liquid touches only the tube, which suits corrosive electrolytes and clean work.",
  ),
  "Wi-Fi peristaltic pump": PUMP_COPY(
    "A Wi-Fi peristaltic pump adds a touchscreen and network control to a peristaltic pump, so flow can be set and programmed precisely. The liquid touches only the tube, so corrosive electrolytes are not a problem.",
  ),
  "dispensing peristaltic pump": PUMP_COPY(
    "A dispensing peristaltic pump delivers set volumes of liquid, for dosing rather than steady circulation. The liquid touches only the tube, so it stays clean and the pump is safe from corrosion.",
  ),
  "dual channel peristaltic pump": PUMP_COPY(
    "A dual channel peristaltic pump runs two tubes from one unit, so it can feed the anode and cathode sides of a cell at the same time. The liquid touches only the tube, so corrosive electrolytes are not a problem.",
  ),
  "peristaltic pump": PUMP_COPY(
    "A peristaltic pump moves liquid by squeezing a flexible tube with rollers, so the liquid touches only the tube. That keeps it clean and protects the pump, which makes it the standard choice for circulating electrolyte in lab cells.",
  ),

  // ── Presses and equipment
  "hot press machine": {
    about:
      "A hot press machine applies heat and pressure together, which is how a membrane electrode assembly (MEA) is bonded for fuel cells and electrolyzers. Controlled temperature and pressure give repeatable assemblies.",
    uses: ["Making membrane electrode assemblies", "Membrane lamination", "Hot pressing of composite samples"],
    care: ["Use release sheets, so that samples do not stick to the platens.", "Let the platens cool before handling, and keep them clean."],
  },
  "30 ton hydraulic press": {
    about:
      "A 30 ton hydraulic press is a four-pillar lab press for applying high, even force to samples, for pressing electrodes, pellets and laminates.",
    uses: ["Pressing electrodes and pellets", "MEA and membrane lamination", "Sample preparation"],
    care: ["Keep force within the rated capacity, and centre the load.", "Check the hydraulic oil level and watch for leaks."],
  },
  "20 ton hydraulic press": {
    about:
      "A 20 ton hydraulic press is a compact four-pillar lab press for applying even force to samples, for pressing electrodes, pellets and laminates.",
    uses: ["Pressing electrodes and pellets", "MEA and membrane lamination", "Sample preparation"],
    care: ["Keep force within the rated capacity, and centre the load.", "Check the hydraulic oil level and watch for leaks."],
  },
  "fuel cell test station": {
    about:
      "A fuel cell test station controls and measures a fuel cell during operation, so that its performance and durability can be evaluated under set conditions.",
    uses: ["Polarisation curves and performance testing", "Durability studies", "Comparing MEAs"],
    care: ["Check gas lines for leaks before each run.", "Follow your lab's rules for working with hydrogen."],
  },
  "fuel cell testing device": {
    about:
      "A fuel cell testing device measures the output of fuel cells and metal-air batteries, so that performance can be evaluated in the lab.",
    uses: ["Fuel cell performance testing", "Metal-air battery testing", "Teaching laboratories"],
    care: ["Stay within the rated power of the device.", "Check connections before each run."],
  },
  "electrolyzer temperature controller": {
    about:
      "An electrolyzer temperature controller is a PID-controlled heating system that holds cell hardware at a set temperature, because temperature strongly affects electrolyzer and fuel cell performance.",
    uses: ["Holding electrolyzer hardware at temperature", "Temperature-dependent performance studies", "Repeatable test conditions"],
    care: ["Place the sensor where it reads the cell's true temperature.", "Stay within the rated temperature."],
  },
  "triboelectric measurement setup": {
    about:
      "A triboelectric measurement setup brings two materials into repeated contact at a controlled speed, for characterising triboelectric nanogenerators (TENGs) and the charge those materials exchange.",
    uses: ["TENG research", "Comparing triboelectric materials", "Energy harvesting studies"],
    care: ["Keep contact surfaces clean between runs.", "Use the same speed and force when comparing samples."],
  },

  // ── Materials
  "zinc sheet": {
    about:
      "A high purity zinc sheet is a metal sheet used as an anode and test material. Zinc's reactivity and low cost make it central to zinc-air and zinc-ion battery research.",
    uses: ["Zinc-air and zinc-ion battery anodes", "Corrosion studies", "Electrodeposition substrates"],
    care: ["Store dry, as zinc develops a surface film in air.", "Clean the surface before use by your protocol."],
  },
  "aluminium sheet": {
    about:
      "A high purity aluminium sheet, also spelt aluminum, is a lightweight, conductive metal sheet. It is used as an electrode, an anode for aluminium-air research and a test material.",
    uses: ["Aluminium-air battery research", "Corrosion and anodising studies", "Fabrication and research work"],
    care: ["Clean off the natural oxide layer by your protocol before use.", "Store dry and flat."],
  },
  "gas sampling bag": {
    about:
      "A gas sampling bag collects and stores gas samples for later analysis, such as gas chromatography. In electrochemistry, it captures gas products from a cell for measurement.",
    uses: ["Collecting gas products from electrolysis", "Gas chromatography samples", "Air and environmental sampling"],
    care: ["Flush the bag with clean gas before use.", "Analyse samples promptly, as gases can slowly diffuse through the film."],
  },
  "manganese dioxide nanoparticles": {
    about:
      "Manganese dioxide nanoparticles (MnO₂) are a low-cost, widely studied oxide for energy storage and catalysis, used in battery and supercapacitor electrodes and as an oxygen reaction catalyst.",
    uses: ["Battery and supercapacitor electrodes", "Oxygen reduction and evolution catalysts", "Environmental catalysis"],
    care: ["Store sealed and dry.", "Handle fine powders under your lab's safety rules, and avoid breathing dust."],
  },
};

/** The written content for this product, or undefined when its family has none yet. */
export function productCopy(p: { name: string; categorySlug: string }): ProductCopy | undefined {
  const head = productSearchTerms(p)[0];
  return head && Object.hasOwn(PRODUCT_COPY, head) ? PRODUCT_COPY[head] : undefined;
}

/** Other products a buyer of this one is choosing between: same family, same plain name. */
export function siblingProducts<T extends { slug: string; name: string; categorySlug: string }>(p: T, all: T[]): T[] {
  const head = productSearchTerms(p)[0];
  if (!head) return [];
  return all.filter((o) => o.slug !== p.slug && productSearchTerms(o)[0] === head);
}
