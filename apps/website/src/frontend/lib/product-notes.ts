/**
 * Written notes for the products people search for most (metnmat.in Search Console,
 * 90 days to 2026-11-02). Family copy says what a kind of product is; these say what
 * this one is for, and how to choose it over its neighbours.
 *
 * Standard practice only. A note may name a size the product's own title states,
 * but never a price, stock level, delivery time, certification or performance
 * figure, and it says nothing a spec does not back. Where the catalogue disagrees
 * with itself (zinc purity, the gas bag's film), the note stays silent on that point.
 * N117, N115 and N212 are PFSA membranes and are never called Nafion.
 *
 * Keyed by product slug. Two paragraphs: what it is for, then how to choose or use it.
 */
export const PRODUCT_NOTES: Record<string, [string, string]> = {
  "high-purity-zinc-sheet": [
    "Zinc sheet is the anode in zinc-air and zinc-ion battery research, and a common substrate for electroplating and corrosion studies. Purity matters in this work because trace metals such as iron and copper speed up hydrogen evolution and self-corrosion on the surface, which changes the result you measure.",
    "Before a test, sand or polish away the oxide film, rinse and dry. Zinc is soft enough to cut with shears, so you can trim it to the size your cell needs. Keep it dry and sealed between experiments, because the surface tarnishes in humid air.",
  ],
  "silver-silver-chloride-ag-agcl-reference-electrode-2-50mm-glass-rod": [
    "This is the slimmest of our glass Ag/AgCl electrodes. It suits micro cells, narrow H-cell ports and setups where a thicker body would block the flow or shadow the working electrode.",
    "A slim tube holds little filling solution, so check the level and the potential more often than you would with a larger electrode. If your port is 4 mm or wider, a thicker model is easier to handle and needs topping up less often.",
  ],
  "platinum-sheet-counter-electrode-30-30-0-1mm": [
    "A large platinum sheet for working electrodes of a few square centimetres, such as a coated plate in a holder. A counter electrode should have more surface than the working electrode, or it can limit the current you measure.",
    "Place the sheet parallel to the working electrode, so that the current spreads evenly across it. Before you order, check that a 30 mm wide sheet passes through the port or lid of your cell. For smaller work, a 10 × 10 mm or 20 × 20 mm sheet is enough.",
  ],
  "30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model": [
    "A four-pillar press for labs that make pellets, compact powders or press membrane electrode assemblies. The four pillars keep the plates parallel under load, which matters when you need a flat, even sample.",
    "Work out the force you need from your die or sample area: pressure is force divided by area, so a larger sample needs far more force for the same pressure. Choose this 30 ton model over the 20 ton press when you work with large dies or high compaction pressures.",
  ],
  "nickel-foam-electrode-200-300-1-5-mm": [
    "Nickel foam is an open, three-dimensional metal sponge. Labs use it as a current collector and catalyst support for water electrolysis in alkaline electrolyte, and in batteries and supercapacitors. The open structure gives a large surface and lets gas bubbles escape.",
    "A full sheet lets you cut many small electrodes from one material, which helps when comparing samples. Cut it with sharp scissors. Many protocols clean the foam first in dilute hydrochloric acid to remove surface oxide, then rinse with water and ethanol. PPI means pores per inch, so a higher number means finer pores.",
  ],
  "swagelok-battery-test-fixture": [
    "A reusable Swagelok type cell for testing battery materials, with a 316 stainless steel body and PEEK insulation. Labs use it for lithium ion, sodium ion and similar chemistries, where it is quicker to assemble than a full pouch cell.",
    "Choose PEEK when you take the cell apart often: it is stiffer than PTFE and holds its shape through repeated tightening. PTFE is the choice for the widest chemical resistance. Assemble in a glove box for air-sensitive materials, and clean the parts between tests so that one experiment does not contaminate the next.",
  ],
  "platinum-wire-counter-electrode-1-37-mm-ptwk": [
    "A short platinum wire on a PEEK rod, the everyday counter electrode for small three-electrode cells. Platinum stays inert in most electrolytes, and the short wire keeps the electrode compact.",
    "PEEK is stiffer than PTFE, so the rod keeps its shape in a tight port. If your working electrode is larger than a small disk, move up to a mesh or sheet, because the counter electrode should have the larger surface.",
  ],
  "ptfe-replaceable-electrode-holder-mpg-10": [
    "This holder clamps a sheet sample so that it can act as the working electrode, with no soldering or wiring. It suits foils, coated plates, carbon paper, carbon cloth and small pieces of metal foam.",
    "Keep the clamp above the electrolyte, so that only your sample is in contact with it. If metal parts of a holder touch the solution, they add current of their own. Mark the depth you immerse the sample, so that the area stays the same from one test to the next.",
  ],
  "hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p": [
    "Hot pressing bonds the catalyst layers and membrane of a membrane electrode assembly under heat and pressure. Good contact between the layers lowers resistance, which is why fuel cell and electrolyzer labs press rather than simply stack the parts.",
    "The right temperature, pressure and time depend on your membrane and ionomer, so start from the maker's data and try spare pieces first. Press between release sheets so that nothing sticks to the plates, and record each setting, because small changes show up in cell performance.",
  ],
  "pfsa-proton-exchange-membrane-300-mm-x-300-mm": [
    "A large sheet of PFSA proton exchange membrane for labs that cut many membrane electrode assemblies, or that work with larger cells. PFSA stands for perfluorosulfonic acid, the most common family of proton exchange membranes for fuel cells and water electrolyzers.",
    "Wear clean gloves and cut on a clean surface with a sharp blade. A PFSA membrane swells when wet, so allow for this when you cut gaskets and seal it into a cell. Store the unused sheet flat and away from dust, and follow the maker's conditioning steps before use.",
  ],
  "graphite-rod-counter-electrode-6-60mm": [
    "A short graphite rod for small cells. Graphite is a common counter electrode in hydrogen evolution studies, because platinum from a platinum counter electrode can dissolve and redeposit on the working electrode, which inflates the measured activity.",
    "Graphite is porous and can hold on to ions from one electrolyte, so keep a rod for each electrolyte you use. It is also brittle, so do not overtighten it in a fitting. For a deeper cell, choose the 80 mm or 120 mm rod.",
  ],
  "photocatalytic-water-splitting-panel-reactors-app-400": [
    "A flat panel reactor for photocatalytic water splitting, where a catalyst film on a plate faces the light through a UV-transparent window. The inclined panel design helps gas bubbles rise away from the catalyst surface instead of sitting on it and blocking the light.",
    "Choose the panel size by how much catalyst you can coat evenly: the larger panel collects more gas, but it needs an even light source across its whole face. Measure the light at the plane of the catalyst, not at the lamp, so that results can be compared between runs.",
  ],
  "silver-silver-chloride-ag-agcl-reference-electrode-4-50mm-glass-rod": [
    "A general purpose Ag/AgCl electrode for neutral and acidic solutions, and a sensible first choice for most three-electrode cells. The 4 mm glass body is sturdier than the slim models and still fits many cell ports.",
    "Store the tip in KCl of the same strength as the filling solution, never in deionised water, which leaches out chloride and shifts the potential. Keep the junction wet, and check the electrode now and then against one you keep only for that purpose.",
  ],
  "gas-sampling-bag-1-litre-with-ptfe-valve": [
    "A 1 litre bag for collecting gas from an electrolysis or CO₂ reduction cell and carrying it to a gas chromatograph. It suits labs that do not have a GC plumbed directly to the cell.",
    "Flush the bag several times with an inert gas before sampling, so that air does not dilute the result. Analyse the sample soon after you take it, because light gases such as hydrogen slowly escape through bag walls. Use a separate bag for each gas mix, and label it with the time and the run.",
  ],
  "piperion-aem": [
    "PiperION is a thin, self-supporting anion exchange membrane that conducts hydroxide ions. Labs use it in AEM water electrolyzers, AEM fuel cells and CO₂ electrolysis, where a thin membrane keeps cell resistance low.",
    "A thin film needs careful handling, so lift it with clean tweezers and keep it flat. Follow the maker's steps for ion exchange before first use. For the catalyst layers, the PiperION ionomer dispersion is the natural partner, because it matches the membrane's chemistry.",
  ],
  "silver-silver-chloride-ag-agcl-reference-electrode-2-4-60mm-glass-rod": [
    "A slim Ag/AgCl electrode with a little more length than the 2 mm model, for narrow ports where the tip has further to reach. Its microporous ceramic junction suits general aqueous work.",
    "Place the tip close to the working electrode without touching it, so that less of the solution's resistance sits between them. A slim tube holds little filling solution, so check the level regularly and top it up with KCl of the same strength.",
  ],
  "hydraulic-pressing-machine": [
    "A manual 20 ton press for pellets, powder compaction and pressing membrane electrode assemblies. It suits labs that press often but do not need the force of a 30 ton press.",
    "The gauge shows the pressure in the hydraulic system, not the pressure on your sample. To find the sample pressure, multiply the gauge reading by the piston area, then divide by the sample area. Keep a note of the gauge reading for each recipe, so that the same pressing can be repeated.",
  ],
  "platinum-mesh-counter-electrode-30-30-mm": [
    "A large woven platinum electrode, also called platinum gauze. Mesh offers far more surface than a sheet of the same outline, so it suits large working electrodes and reactions that produce a lot of gas, because bubbles pass through rather than cling to the surface.",
    "Keep the mesh flat and do not press it against the cell wall, since platinum is soft and creases easily. For smaller cells, the 10 × 10 mm and 20 × 20 mm meshes take up less room.",
  ],
  "ptfe-replaceable-platinum-electrode-holder": [
    "A PTFE holder with a replaceable platinum electrode, for work that needs a platinum surface with a defined area. PTFE resists most electrolytes, and the replaceable design means you do not have to change the whole electrode when the platinum needs renewing.",
    "Clean the platinum before critical measurements, because a contaminated surface changes the result. Tighten the holder gently: PTFE is soft and a stripped thread loses its grip.",
  ],
  "saturated-calomel-electrode-hg-hg2cl2": [
    "The saturated calomel electrode, or SCE, is a classic reference for neutral and acidic solutions, and many older papers and corrosion standards quote potentials against it. Choose it when you need to compare your results directly with that work.",
    "It contains mercury, so follow your lab's rules for storage, breakage and disposal. Keep it within its rated temperature, and keep KCl crystals in the filling solution so that it stays saturated. Where chloride would harm your sample, use a salt bridge or a chloride-free reference.",
  ],
  "platinum-wire-counter-electrode-0-5-37mm-peek-rod": [
    "A fine platinum wire on a PEEK rod for small cells and low current work, where a thick wire or sheet would be more than the cell needs. Platinum stays inert in most electrolytes, so the counter electrode rarely interferes with the reaction you are measuring.",
    "Thin wire bends easily, so handle it gently and do not let it touch the working electrode. In hydrogen evolution studies, consider a graphite counter electrode, because platinum can dissolve and redeposit on the sample.",
  ],
  "graphite-rod-counter-electrode-6-80-mm": [
    "A mid-length graphite rod that reaches deeper into a cell than the 60 mm rod while staying easy to fit. It is a low-cost counter electrode, and it avoids platinum contamination in hydrogen evolution work.",
    "The surface in contact with the electrolyte depends on how deep you immerse the rod, so note the depth for repeatable results. Rinse it after use, and dry it before you store it.",
  ],
  "perfluorosulfonic-acid-pfsa-resin-dispersion-5wt-solution": [
    "A PFSA ionomer dispersion, the binder and proton conductor in catalyst inks. Mixed with catalyst and solvent, it holds particles to a glassy carbon disk, gas diffusion layer or membrane, and carries protons through the catalyst layer.",
    "Too little ionomer loosens the layer and starves it of protons, and too much blocks gas and the catalyst surface, so test a few ratios for your catalyst. Mix the ink well before you apply it, and record the amount used in each batch.",
  ],
  "platinum-spiral-counter-electrode": [
    "A long platinum wire coiled into a spiral, which packs a large surface into a small volume. It gives an even current around the working electrode, and it suits water splitting reactors, where a straight wire would have too little surface.",
    "Keep the coil from touching the working electrode or the cell wall. Rinse it after each run, and do not stretch the spiral: platinum is soft and will not spring back to its shape.",
  ],
  "metal-air-battery-reactor": [
    "An air-breathing test cell for metal-air batteries such as zinc-air and aluminium-air. The transparent PMMA body lets you watch the electrolyte and the metal anode while the cell runs, which helps when studying gas evolution or dendrites.",
    "Keep the air side dry: an air cathode that floods with electrolyte stops working. PMMA suits aqueous electrolytes, but many organic solvents attack it, so check before you use one. Choose among the models by the electrode layout your experiment needs.",
  ],
  "transparent-carbon-dioxide-gas-diffusion-flow-cell": [
    "A CO₂ reduction flow cell with a see-through body, so you can watch gas bubbles, electrolyte flow and flooding while it runs. Feeding CO₂ through a gas diffusion electrode reaches far higher current densities than an H-cell, where CO₂ must dissolve first.",
    "Watch the gas side for liquid, which is the first sign of flooding. Balance the gas and electrolyte pressures, and keep flow rates steady. PMMA suits aqueous electrolytes, but many organic solvents attack it.",
  ],
  "noble-metal-plate-platinum-30-30-0-1mm": [
    "A plain platinum plate for use as a counter or working electrode, or as a substrate of its own. Its specs list no rod, so it suits a clamp-type holder, or a setup where you make your own connection.",
    "Handle it with clean tweezers, because skin oils contaminate the surface. A plate this thin bends easily, so support it evenly in the holder. If you want a ready-to-use electrode on a rod, see the platinum sheet counter electrodes.",
  ],
  "hg-hgo-reference-electrode-6-70-mm": [
    "An Hg/HgO reference electrode with a 1 M KOH filling, the usual reference for alkaline electrolytes such as KOH and NaOH. An Ag/AgCl electrode can drift in strong alkali, so Hg/HgO is the better choice for alkaline HER and OER studies.",
    "Match the filling solution to your electrolyte where you can, and keep the tip wet. It contains mercury, so follow your lab's rules for storage, breakage and disposal. To report against RHE, use our potential converter.",
  ],
  "compact-peristaltic-pump-knob-control-65-ml-min": [
    "A small 24 V peristaltic pump with a simple speed knob, for circulating electrolyte through flow cells and small electrolyzers. The liquid touches only the tube, so changing electrolyte means changing the tube, and the pump itself stays clean.",
    "Check the real flow with a measuring cylinder, because it depends on the tube you fit. It has no reverse function, so plan your tubing for flow in one direction. Choose a tube material that resists your electrolyte, and replace it when it wears.",
  ],
  "platinum-sheet-counter-electrode-10-10-0-1mm": [
    "The smallest of our platinum sheet electrodes, sized for small cells and for disk working electrodes such as a 3 mm glassy carbon disk. It has a known flat area, which a coil or a mesh does not.",
    "Even a small sheet has many times the surface of a 3 mm disk, so it will not limit the current in most work. Handle it by the rod and keep the sheet flat, because a sheet this thin bends easily.",
  ],
};

export const productNotes = (slug: string) => (Object.hasOwn(PRODUCT_NOTES, slug) ? PRODUCT_NOTES[slug] : undefined);
