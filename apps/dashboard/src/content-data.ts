/**
 * Seed content for the website CMS — mirrors the website's original
 * placeholder.ts / site.ts so a fresh database renders identically, after
 * which staff edit it in the admin. Seeded idempotently (only when empty).
 */

export const seedServices = [
  { slug: "product-process-development", title: "Product & Process Development", icon: "rocket", summary: "We develop lab-scale prototypes and scale them up to full industrial-scale implementation." },
  { slug: "applied-research-consultancy", title: "Applied Research & Consultancy", icon: "lightbulb", summary: "Turnkey industrial solutions that improve your processes in cost, quality and efficiency." },
  { slug: "process-quality-improvement", title: "Process & Quality Improvement", icon: "gauge", summary: "Ongoing effort to identify and eliminate defects and errors across your production process." },
  { slug: "product-benchmarking", title: "Product Benchmarking", icon: "target", summary: "Compare your products and services against market competitors to find the edge." },
  { slug: "microstructure-heat-treatment", title: "Microstructure Control & Heat Treatment", icon: "flame", summary: "Optimize multi-phase microstructure — volume fraction, morphology and phase distribution — through heat treatment." },
  { slug: "modeling-simulations", title: "Modeling & Simulations", icon: "cpu", summary: "Design and develop your process and product using advanced modeling and simulations." },
  { slug: "materials-testing-characterization", title: "Materials Testing & Characterization", icon: "microscope", summary: "Mechanical, microstructural and compositional testing and characterization of your materials." },
  { slug: "materials-processing-facilities", title: "Materials Processing Facilities", icon: "factory", summary: "Advanced materials-processing equipment and facilities to develop, refine and scale your process." },
];

/**
 * Old generic placeholder projects — removed by the boot migration once the
 * real case studies below are present. (oxygen-free-copper-alloy is reused, so
 * it is NOT in this list — its URL is preserved.)
 */
export const dummyProjectSlugs = [
  "microstructure-optimization",
  "process-cost-reduction",
  "competitive-benchmarking",
  "prototype-to-scale-up",
  "process-modeling-simulation",
];

/**
 * Real METNMAT case studies (content from metnmat.in/projects). `bodyText` is
 * plain text — blank lines separate paragraphs; the seed converts it to Lexical
 * so it renders as rich text and stays editable in the admin. `highlights` are
 * shown as a stat strip; only concrete, source-stated facts are included (no
 * invented numbers). Further projects are authored directly in the CMS.
 */
export const seedProjects = [
  {
    slug: "microstructure-control-heat-treatment",
    title: "Microstructure Control & Heat Treatment",
    subtitle: "Engineering multi-phase microstructures for application-specific properties",
    category: "Heat Treatment",
    order: 0,
    tags: ["Heat treatment", "Microstructure", "Phase engineering"],
    summary:
      "Optimising multi-phase microstructure — volume fraction, morphology and phase distribution — through heat treatment to deliver the exact property balance an application needs.",
    bodyText:
      "Optimisation of multi-phase microstructure to obtain a suitable volume fraction, morphology and distribution of different phases through heat treatment. The engineered microstructure imparts one — or a combination — of strength, ductility, wear resistance and other properties as required by the application.",
  },
  {
    slug: "modeling-simulations",
    title: "Modeling & Simulations",
    subtitle: "Designing processes and products with advanced computational tools",
    category: "Simulation",
    order: 1,
    tags: ["Simulation", "Process design", "Cost reduction"],
    summary:
      "Empowering industries to design and develop their process and product using advanced modeling and simulation — enabling informed decisions, lower manufacturing costs and improved product quality.",
    bodyText:
      "Empowering industries to design and develop their process and product using advanced modeling and simulations. This helps industries take informed decisions, lower manufacturing costs and improve product quality.",
  },
  {
    slug: "oxygen-free-copper-alloy",
    title: "Oxygen-Free High-Strength Electrical Copper Alloy",
    subtitle: "High conductivity and high strength in a single copper alloy",
    category: "Alloy Development",
    order: 2,
    tags: ["Copper alloy", "Electrical conductivity", "Cold working", "Aging"],
    highlights: [
      { label: "Conductivity", value: "91–93% IACS" },
      { label: "Cold reduction", value: "60–90%" },
    ],
    summary:
      "A copper alloy engineered through alloying, rapid quenching, de-oxidation, cold reduction and aging to reach 91–93% IACS conductivity together with high strength.",
    bodyText:
      "Addition of a suitable alloying element in copper to ensure complete solid solubility, followed by rapid quenching. The melt is treated with a suitable mix of de-oxidisers to prevent loss of alloying elements. A further 60–90% cold reduction imparts strength, followed by an aging treatment that improves electrical conductivity to about 91–93% IACS.",
  },
  {
    slug: "alumina-insulation-fiber-board",
    title: "High-Temperature Alumina Insulation Fiber Board",
    subtitle: "Furnace-lining insulation that withstands ~1800°C",
    category: "High-Temperature Materials",
    order: 3,
    tags: ["Alumina", "Thermal insulation", "Furnace lining", "Import substitution"],
    highlights: [
      { label: "Service temperature", value: "~1800°C" },
      { label: "Shrinkage", value: "Very low" },
    ],
    summary:
      "Furnace-lining insulation fabricated to withstand ~1800°C with very low shrinkage and thermal conductivity — improving furnace insulation and reducing dependency on imports.",
    bodyText:
      "Insulation materials used in furnace lining are fabricated to withstand high temperatures of around 1800°C, with very low shrinkage and thermal conductivity at high temperature. The technology improves furnace insulation, reduces dependency on foreign imports, and enables furnace manufacturers to make the material in-house.",
  },
  {
    slug: "casting-yield-optimization",
    title: "Casting Yield Optimization",
    subtitle: "Recycling waste process heat to lift casting yield",
    category: "Waste Heat Recovery",
    order: 4,
    tags: ["Thermoelectric", "Waste heat", "Casting", "Sustainability"],
    summary:
      "A thermoelectric material-based system that recycles waste process heat to hold consistent, controlled temperatures during casting — improving product quality, reducing defects and cutting material waste.",
    bodyText:
      "Our thermoelectric material-based system offers benefits in energy efficiency, sustainability and casting-yield optimisation. It efficiently recycles waste process heat to maintain consistent and controlled temperatures during casting, resulting in improved product quality and reduced defects. This optimisation enhances productivity, reduces material waste, and contributes to cost savings and environmental sustainability.",
  },
  {
    slug: "ferritic-stainless-steel-texture",
    title: "Texture Analysis of Ferritic Stainless-Steel Sheet",
    subtitle: "Improving deep drawability through recrystallisation texture control",
    category: "Heat Treatment",
    order: 5,
    tags: ["Ferritic stainless steel", "Texture", "Deep drawing", "Thermo-mechanical processing"],
    summary:
      "Improving the deep drawability of ferritic stainless steel by raising the r-value through microstructure and recrystallisation-texture control via multistage thermo-mechanical processing.",
    bodyText:
      "Deep drawability of ferritic stainless steel is improved by increasing the r-value, which depends on microstructure and recrystallisation texture. Multistage thermo-mechanical processing is performed to impart a homogeneous distribution of <111> || ND oriented grains.",
  },
  {
    slug: "high-temperature-ceramic",
    title: "High-Temperature Ceramic",
    subtitle: "Thermally stable ceramics for thermoelectric waste-heat systems",
    category: "High-Temperature Materials",
    order: 6,
    tags: ["Ceramics", "Thermoelectric", "Thermal stability"],
    summary:
      "High-temperature ceramics with excellent thermal stability and electrical conductivity that form a robust foundation for thermoelectric modules — enabling efficient heat-to-electricity conversion at elevated temperatures.",
    bodyText:
      "High-temperature ceramics can play a crucial role in the success of thermoelectric material-based systems for recycling waste process heat. With their excellent thermal stability and electrical conductivity, these ceramics provide a robust foundation for the thermoelectric modules, enabling efficient heat-to-electricity conversion at elevated temperatures. Incorporating high-temperature ceramics enhances the durability and performance of the technology, further contributing to improved energy efficiency and sustainability in manufacturing processes.",
  },
  {
    slug: "aluminum-foam",
    title: "Lightweight & High-Strength Aluminum Foam",
    subtitle: "A melting-and-casting route to high-performance metal foam",
    category: "Alloy Development",
    order: 7,
    tags: ["Aluminum foam", "Energy absorption", "Lightweighting", "Casting"],
    summary:
      "A melting-and-casting process for aluminum foam with high energy absorption, sound and thermal insulation and corrosion resistance — delivering high compressive strength at low density.",
    bodyText:
      "Aluminum foams have excellent properties such as high energy absorption, sound and thermal insulation, and corrosion resistance. The objective of this project was to develop a process for making aluminum foam through a melting and casting route. The effects of process parameters — foaming-agent content, casting temperature and holding time — were optimised. The resulting aluminum foam showed excellent mechanical properties with high compressive strength and low density.",
  },
  {
    slug: "composite-materials",
    title: "Composite Materials",
    subtitle: "Tuning thermoelectric properties for better waste-heat recovery",
    category: "Composites",
    order: 8,
    tags: ["Composites", "Thermoelectric", "Energy conversion"],
    summary:
      "Composite materials engineered to optimise thermoelectric properties — electrical and thermal conductivity — for improved energy-conversion efficiency, durability and flexibility across industries.",
    bodyText:
      "Composite materials offer an excellent opportunity to further enhance the efficiency and sustainability of thermoelectric material-based systems for recycling waste process heat. By incorporating composite materials into the design, it is possible to optimise thermoelectric properties such as electrical conductivity and thermal conductivity, resulting in improved energy-conversion efficiency. Composite materials also provide enhanced durability and flexibility, enabling their application across a wide range of industries for more effective waste-heat recovery and utilisation.",
  },
  {
    slug: "surface-casting-improvement",
    title: "Surface Casting Improvement",
    subtitle: "Capturing waste heat to optimise surface-casting processes",
    category: "Waste Heat Recovery",
    order: 9,
    tags: ["Thermoelectric", "Waste heat", "Surface casting", "Emissions"],
    summary:
      "Applying thermoelectric waste-heat recycling to surface casting — optimising energy use, reducing operating costs and minimising greenhouse-gas emissions in this specific manufacturing technique.",
    bodyText:
      "In addition to its benefits for energy efficiency and sustainability, our thermoelectric material-based system contributes to improving surface-casting processes. By capturing and utilising waste heat generated during surface casting, the technology helps optimise energy consumption, reduce operating costs and minimise greenhouse-gas emissions in this specific manufacturing technique. This integration of thermoelectric recycling into surface casting enhances the overall energy efficiency and sustainability of the production process.",
  },
  {
    slug: "material-synthesis",
    title: "Material Synthesis",
    subtitle: "Advanced fabrication of high-performance thermoelectric materials",
    category: "Waste Heat Recovery",
    order: 10,
    tags: ["Material synthesis", "Thermoelectric", "Fabrication"],
    summary:
      "Developing advanced fabrication techniques and optimising composition and structure to create thermoelectric materials with high electrical and low thermal conductivity — maximising waste-heat-to-electricity conversion.",
    bodyText:
      "To achieve efficient thermoelectric material synthesis for recycling waste process heat, our team focuses on developing advanced fabrication techniques and optimising the composition and structure of the materials. By carefully controlling the synthesis parameters and employing innovative approaches, we aim to create thermoelectric materials with enhanced properties such as high electrical conductivity and low thermal conductivity. This enables us to maximise the conversion of waste heat into usable electricity, contributing to improved energy efficiency and sustainability across industries.",
  },
  {
    slug: "new-aluminum-alloy",
    title: "New Aluminum Alloy Development",
    subtitle: "Custom alloys for transportation, aerospace and construction",
    category: "Alloy Development",
    order: 11,
    tags: ["Aluminum alloy", "Aerospace", "Transportation", "Thermo-mechanical processing"],
    summary:
      "Custom aluminum alloys developed through melting, casting and thermo-mechanical processing — tuned for strength, ductility and corrosion resistance across transportation, aerospace and construction.",
    bodyText:
      "Our expertise in melting, casting and thermo-mechanical processing allows us to develop and optimise aluminum alloys for diverse applications, including transportation, aerospace and construction. We customise the composition and processing of aluminum alloys to meet specific performance requirements such as strength, ductility and corrosion resistance. We also offer tailored solutions to reduce material costs and enhance the sustainability of aluminum production, helping industries achieve their material-property and business objectives.",
  },
  {
    slug: "wear-resistant-composites",
    title: "Wear-Resistant Composite Materials",
    subtitle: "Metal-matrix composites tailored by interfacial bonding",
    category: "Composites",
    order: 12,
    tags: ["Metal-matrix composites", "Wear resistance", "Reinforcement"],
    summary:
      "Metal-matrix composites with a wide range of selectable ceramics and reinforcements — with properties tuned through interfacial bonding between reinforcement and matrix.",
    bodyText:
      "We develop and manufacture metal-matrix composites. Depending on the application, a wide range of ceramic and reinforcement materials can be selected or further developed. The properties of the metal-matrix composites depend on the interfacial bonding between the reinforcement and the matrix. We provide customised solutions to enhance the performance and functionality of the composite materials.",
  },
  {
    slug: "waste-heat-recycling-system",
    title: "Advanced Solid-State Waste-Heat Recycling System",
    subtitle: "Turning lost process heat back into usable energy",
    category: "Waste Heat Recovery",
    order: 13,
    tags: ["Thermoelectric", "Waste heat", "Energy efficiency", "Emissions"],
    highlights: [{ label: "Energy lost as heat", value: "20–50%" }],
    summary:
      "An efficient thermoelectric material-based system for recycling waste process heat — cutting energy consumption and operating costs while minimising greenhouse-gas emissions, where 20–50% of manufacturing energy is otherwise lost as heat.",
    bodyText:
      "Manufacturing processes generate a substantial amount of waste heat, with an estimated 20–50% of energy being lost in the form of heat. Our team has developed an efficient thermoelectric material-based system for recycling waste process heat. The technology has the potential to reduce energy consumption and operating costs across industries, while also minimising greenhouse-gas emissions. It enhances the energy efficiency and sustainability of production processes.",
  },
  {
    slug: "casting-defects",
    title: "Reducing Casting Defects in Metal",
    subtitle: "Stabilising casting conditions with recovered waste heat",
    category: "Waste Heat Recovery",
    order: 14,
    tags: ["Thermoelectric", "Casting quality", "Defect reduction"],
    summary:
      "Applying thermoelectric waste-heat recycling to metal casting — optimising energy use and improving operating conditions to minimise casting defects for a more reliable, high-quality process.",
    bodyText:
      "Casting defects in metal production can be addressed by implementing the thermoelectric material-based system for recycling waste process heat. By efficiently capturing and utilising the waste heat generated during casting, this technology optimises energy consumption, improves operating conditions and minimises casting defects. The enhanced energy efficiency and sustainability offered by the system contribute to a more reliable and high-quality metal-casting process.",
  },
];

/**
 * The original three placeholder posts (seeded before real content existed).
 * The boot migration removes these from existing databases the first time it
 * runs — new/renamed articles created by staff are never touched.
 */
export const dummyPostSlugs = [
  "iacs-oxygen-free-copper",
  "microstructure-heat-treatment",
  "why-benchmarking-accelerates-rd",
];

/**
 * Real METNMAT-written articles (from the editorial team's manuscripts).
 * `bodyText` is plain text — blank lines separate paragraphs; the seed converts
 * it to Lexical rich text so it is fully editable in the admin. Further
 * articles are authored directly in the CMS.
 */
export const seedPosts = [
  {
    slug: "ion-exchange-membranes",
    title: "Ion Exchange Membranes (IEM)",
    category: "Electrochemistry",
    categorySlug: "electrochemistry",
    contentTypeSlug: "technical-article",
    coverAsset: "src/seed-assets/blog/iem-cover.webp",
    coverAlt: "Ion exchange membrane transporting H+ and OH- ions between porous electrode layers",
    author: "METNMAT Research Team",
    publishedDate: "2026-07-03T09:00:00.000Z",
    excerpt:
      "What ion exchange membranes are, how protons and hydroxide ions move through them, and the physical and electrochemical properties that decide which membrane fits your electrolyzer or fuel cell.",
    abstract:
      "Ion exchange membranes (IEMs) are semipermeable dense layers that selectively transport ions, and they sit at the heart of green hydrogen production and fuel cells. This article introduces the two membrane families — cation and anion exchange membranes — explains the vehicular and Grotthuss proton-transport mechanisms, and summarises the physical and electrochemical properties (thickness, swelling ratio, porosity, areal resistance, ionic selectivity) that determine membrane performance in real devices.",
    keywords: "ion exchange membrane, IEM, PEM, AEM, proton exchange membrane, Grotthuss mechanism, green hydrogen, fuel cells",
    researchArea: "Membrane electrochemistry",
    tags: [{ tag: "Membranes" }, { tag: "PEM" }, { tag: "AEM" }, { tag: "Green Hydrogen" }],
    bodyText: `An ion exchange membrane (IEM) is a semipermeable dense layer that selectively allows ions to pass through. IEMs are broadly divided into two families: anion exchange membranes (AEM) and cation exchange membranes (CEM) — as the names suggest, AEMs and CEMs selectively allow anions and cations to pass through them, respectively. IEMs are widely used in different applications, including the energy, water treatment, pharmaceutical and food industries. With the increasing demand and aspiration of building a greener future, IEMs are abundantly used in green hydrogen production and its utilisation in fuel cells.

However, in hydrogen energy applications the cation to be transported is the proton (H+), hence CEMs are often referred to as proton exchange membranes (PEMs) in water electrolyzers and fuel cells. The mechanisms usually involved in the transport of protons are the vehicular mechanism and the Grotthuss mechanism, also known as the hopping/shuttling mechanism. The vehicular mechanism involves transport of protons in the form of H3O+ ions from one side to the other via diffusion or movement, without transfer of the proton to another water molecule. The Grotthuss mechanism, in contrast, involves continuous transfer of the proton to the next water molecule, creating a continuous chain. This can be achieved if the polymer of the membrane itself supports the mechanism — hence polymers involving anionic functional groups (e.g. –OH) in their structures are used, for example perfluorosulfonic acid (PFSA) and sulphonated poly ether ether ketone (SPEEK).

Meanwhile, AEMs are used in many applications at industrial level, especially in the food industry, where AEMs are used for deacidification of juices, dairy processing and more. AEMs grabbed the attention of researchers and scientists for green hydrogen applications between the mid-2010s and 2020. One of the reasons is the high cost of the catalysts used in PEM water electrolyzers and fuel cells. Similar to the mechanisms explained above, AEMs transport OH- ions where the carriers are water molecules with hydrogen bonds, unlike in PEMs where dative bonds are present. Polymers used in AEM synthesis include cationic functional groups, with quaternary ammonium (e.g. –[N(CH3)3]+), one of the more stable cations, being widely used.

Beyond the chemistry of ion transport, membrane selection also depends on physical and electrochemical properties such as thickness, melting point, swelling ratio, tensile strength, porosity, areal resistance and ionic selectivity. As a rule of thumb: the thinner the membrane, the higher its conductivity and the lower its strength. Likewise, the higher the porosity, the higher the electrolyte-holding capacity — decreasing resistance, but simultaneously increasing water uptake. It is also important to use dense membranes with no or very low pore size to avoid gas transport across the membrane.`,
  },
  {
    slug: "anion-exchange-membrane-water-electrolysis",
    title: "Anion Exchange Membrane Water Electrolysis (AEMWE)",
    category: "Hydrogen & Fuel Cells",
    categorySlug: "hydrogen-fuel-cells",
    contentTypeSlug: "technical-article",
    coverAsset: "src/seed-assets/blog/aemwe-cover.webp",
    coverAlt: "Exploded view of an AEMWE electrolyzer cell: endplates, porous electrodes and the anion exchange membrane transporting OH- ions, splitting water into hydrogen and oxygen",
    author: "METNMAT Research Team",
    publishedDate: "2026-07-03T09:30:00.000Z",
    excerpt:
      "How anion exchange membrane water electrolysis works — cell components, electrolyte choices and the four cell configurations — and why AEMWE is emerging as an economical route to green hydrogen.",
    abstract:
      "Anion exchange membrane water electrolysis (AEMWE) splits water into hydrogen and oxygen using an anion exchange membrane sandwiched between the anode and cathode. This article walks through the working principle and cell construction — catalysts, current collectors, gaskets and endplates — the role of the KOH electrolyte, the four electrolyte-feed configurations, and the cost advantages of AEMWE over proton exchange membrane water electrolysis.",
    keywords: "AEMWE, water electrolysis, anion exchange membrane, green hydrogen, electrolyzer, KOH electrolyte, PEMWE",
    researchArea: "Water electrolysis",
    tags: [{ tag: "AEMWE" }, { tag: "Water Electrolysis" }, { tag: "Green Hydrogen" }, { tag: "Electrolyzers" }],
    bodyText: `Water electrolysis is the process of splitting water into hydrogen (H2) and oxygen (O2). This can be achieved via different processes, including electrochemical, photochemical, photoelectrochemical, thermal and mechanical routes. Electrochemical and photoelectrochemical processes have gained importance due to their comparatively high energy efficiency. It is very important to make sure that the hydrogen produced is not mixed with oxygen — which could lead to a highly exothermic reaction producing water — while also maintaining hydrogen purity. One of the main reasons industries and researchers focus on membrane-based electrolyzers is their low area utilisation, creating a high energy density.

Anion exchange membrane water electrolysis (AEMWE) involves oxidation of OH- ions on the anodic side and reduction of H2O into H2 on the cathodic side. The OH- ions produced during reduction on the cathodic side are transported through the anion exchange membrane to the anodic side, completing the circuit. Hence the main components of an AEMWE cell are the cathode and anode (usually catalysts) with a membrane sandwiched in between. To supply electricity, the cathode and anode are attached to current collectors, and channels are machined into the current collectors themselves to allow the flow of electrolyte and products in and out of the cell. Direct contact between the anodic and cathodic current collectors is avoided by introducing two gaskets (non-conductors). In addition, endplates can be fitted on both sides of the cell, with gaskets between the collectors and the endplates.

The electrolyte used for AEMWE is typically a KOH solution, which enhances the reaction kinetics compared to pure water. Apart from the catalyst and membrane efficiencies, cell efficiency also depends on the electrolyte concentration, the flow rate and the number of channels in the attached current collectors. Beyond efficiency, it is very important to ensure the cell has zero gap, so that neither the produced gas nor the liquid electrolyte can pass where it should not.

Depending on how the electrolyte is fed, there are four different kinds of cells. In the most widely used configuration, liquid electrolyte is passed through both sides — cathode and anode. In the sweeping-gas configuration, one side of the cell is fed with an inert gas while an alkaline solution is passed on the other. If one side of the cell is instead maintained under vacuum, the cell is known as a vacuum-based water electrolyzer. A further type involves sweeping inert gas on the anodic side, in which case H2O molecules — rather than OH- ions — are transported across the membrane. In comparison with proton exchange membrane water electrolysis (PEMWE), AEMWE is preferred because the catalysts used are economical, and it has been reported that the start-up time for electrolysis is lower for AEMWE than for PEMWE.`,
  },
  {
    slug: "co2-fuel-cells",
    title: "CO₂ Fuel Cells: Turning a Greenhouse Gas into Stored Power",
    category: "Electrochemistry",
    categorySlug: "electrochemistry",
    contentTypeSlug: "review-article",
    coverAsset: "src/seed-assets/blog/co2-fuel-cell-cover.webp",
    coverAlt: "Exploded view of a CO₂ electroreduction cell: CO₂ fed in at the cathode, electrons flowing through the external circuit, and products — CO, formate, hydrocarbons and alcohols — coming out.",
    author: "METNMAT Research Team",
    publishedDate: "2026-07-07T09:00:00.000Z",
    excerpt:
      "Metal–CO₂ cells turn carbon dioxide from waste into an active reactant — reducing it at the cathode while storing energy at high density. Where the science stands, and why the remaining bottlenecks are, above all, materials problems.",
    abstract:
      "Metal–CO₂ cells and CO₂ fuel cells reduce carbon dioxide at a catalytic gas cathode while delivering electrical energy, fixing it into a solid carbonate. This review outlines the two device concepts — rechargeable metal–CO₂ batteries and continuous-feed fuel cells — the archetypal Li–CO₂ discharge chemistry and its high theoretical energy density, and why the central obstacle (reversibly forming and decomposing an insulating lithium carbonate) makes bifunctional cathode catalysts, discharge-product steering, and electrolyte/interphase engineering the defining materials challenges of the field.",
    keywords:
      "CO2 fuel cell, metal-CO2 battery, Li-CO2, CO2 reduction reaction, CRR, bifunctional catalyst, carbon utilization, energy storage, lithium carbonate",
    researchArea: "Electrochemical energy storage",
    tags: [{ tag: "CO₂ Reduction" }, { tag: "Energy Storage" }, { tag: "Catalysis" }, { tag: "Metal–CO₂ Cells" }],
    bodyText: `Metal–CO₂ cells sit at the intersection of carbon utilization and high-density energy storage. Here is where the science stands — and why the remaining bottlenecks are, above all, materials problems.

Few molecules are as unwelcome in the energy conversation as carbon dioxide. Yet a growing class of electrochemical devices treats CO₂ not as waste to be sequestered, but as an active reactant to be consumed. Broadly termed metal–CO₂ cells — and, in their continuous-feed configurations, CO₂ fuel cells — these systems reduce carbon dioxide at the cathode while delivering electrical energy, fixing it into a solid carbonate in the process. For a research community working on metals and materials, they represent one of the more compelling problems on the bench today: a single device that promises to address decarbonization and energy storage at once.

## One chemistry, two device concepts

It is worth being precise about terminology, since the literature uses both. A metal–CO₂ battery is a closed, rechargeable system: it captures CO₂ during discharge through the CO₂ reduction reaction (CRR) and releases it during charge through the CO₂ evolution reaction (CER). A metal–CO₂ fuel cell, by contrast, is typically a primary device fed a continuous stream of CO₂ — recently demonstrated, for example, in a Mg–CO₂ system using a composite gas-diffusion cathode and a choline chloride deep eutectic electrolyte. Different engineering, same core cathode electrochemistry.

## The working principle

A metal–CO₂ cell couples a reactive metal anode (Li, Na, K, Mg, Al, or Zn) to a porous, catalytically active gas cathode where CO₂ is supplied. Taking the lithium system as the archetype, discharge proceeds along the widely accepted reaction:

4 Li + 3 CO₂ → 2 Li₂CO₃ + C

with the reverse process — decomposing lithium carbonate and evolving CO₂ — occurring on charge. The appeal is energetic: non-aqueous Li–CO₂ and Na–CO₂ chemistries offer theoretical energy densities on the order of 1876 and 1136 Wh kg⁻¹ respectively, comfortably beyond today's lithium-ion cells.

The catch is embedded in that same equation. Lithium carbonate is a wide-bandgap insulator, and decomposing it demands a high potential. The result is a large charge overpotential, sluggish redox kinetics, and discharge products that accumulate at the cathode–electrolyte interface, raising impedance and eroding cycle life. This single fact — the difficulty of reversibly making and unmaking an insulating carbonate — drives most of the field's research agenda.

## Why this is a materials problem

Nearly every open challenge in metal–CO₂ cells resolves into a question of materials design.

Bifunctional cathode catalysts. The central requirement is a catalyst that accelerates both the CRR and the CER — activity in one direction is not enough. Candidates span carbon nanostructures (carbon nanotubes, graphene, heteroatom-doped carbons), noble metals (notably ruthenium and iridium), transition-metal carbides such as Mo₂C, single-atom catalysts, MOF-derived architectures, high-entropy alloys, and polyoxometalates. Each trades off catalytic activity, conductivity, cost, and mass transport differently.

Steering the discharge product. A promising direction is designing catalysts that direct the reaction toward more readily decomposable phases — favoring a lithium oxalate (Li₂C₂O₄) pathway over stubborn Li₂CO₃, for instance. Density-functional studies pairing specific crystal facets with particular nucleation products are now guiding catalyst selection rather than merely rationalizing it after the fact.

Electrolytes and interphases. Electrolyte stability against reactive reduction intermediates remains a limiting factor, motivating work on deep eutectic solvents, ionic liquids, and solid-state approaches. On the anode side, dendrite growth, corrosion, and interphase instability of the reactive metal must all be controlled.

## The road ahead

Despite genuine progress, round-trip efficiency, reversibility, and cycle life remain below what practical deployment requires, and the complexity of the gas–liquid–solid interface continues to resist simple solutions. Scale-up introduces further questions: cell engineering, continuous CO₂ delivery for fuel-cell modes, and tolerance to realistic feed streams laden with O₂, water vapor, and other flue-gas impurities.

What has changed is the character of the effort. The field is shifting from serendipitous proof-of-concept toward rational, materials-by-design development — where catalyst architectures, electrolyte chemistries, and interphase engineering are the levers being pulled deliberately. For the metals and materials community, that is precisely the opportunity: the next breakthroughs in CO₂ fuel cells will be won at the level of structure, composition, and interface.`,
  },
];

export const seedFaqs = [
  { question: "What does METNMAT Research & Innovations do?", answer: "METNMAT is India's private metallurgy & materials R&D company. We deliver customized turnkey solutions — from lab-scale prototype to full industrial scale — across product and process development, applied research, benchmarking, heat treatment and simulation." },
  { question: "What products can I buy from METNMAT?", answer: "Our shop offers lab-grade electrochemistry equipment: electrodes (reference, counter and working), ion-exchange membranes (PEM, AEM, bipolar and cation), electrochemical cells & reactors, lab equipment (peristaltic pumps, MEA fabrication presses, specialised research setups) and accessories — with bulk B2B pricing and GST invoicing." },
  { question: "Do you ship across India and worldwide?", answer: "Yes. We ship across India and worldwide, with a GST invoice provided on every order." },
  { question: "Can I request a customized product?", answer: "Yes. Use the 'Request for Customization' option on any product to share your design, size, material and quantity — you can also attach PDFs or photos — and our team will get back to you with a quote." },
  { question: "What is your oxygen-free high-strength copper alloy?", answer: "It is a copper alloy developed by METNMAT using alloying, rapid quenching, de-oxidation, 60–90% cold reduction and aging treatment to achieve 91–93% IACS electrical conductivity together with high strength." },
];

export const seedHomepage = {
  eyebrow: "India's private Metallurgy & Materials R&D",
  titleLead: "Turning materials science into",
  titleAccent: "industrial advantage",
  subtitle:
    "Customized turnkey R&D solutions for metallurgy & materials industries — from lab-scale prototype to full industrial scale, making your process cheaper, cleaner and stronger.",
  primaryCtaLabel: "Explore METNMAT",
  primaryCtaHref: "/services",
  secondaryCtaLabel: "Shop Now",
  secondaryCtaHref: "/shop",
  stats: [
    { value: "100+", label: "R&D projects delivered" },
    { value: "2018", label: "Innovating since" },
    { value: "91–93%", label: "IACS conductivity" },
  ],
  showClients: true,
  showServices: true,
  showProjects: true,
  showBlog: true,
};

export const seedNavigation = {
  headerLinks: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "Services", href: "/services" },
    { label: "Projects", href: "/projects" },
    { label: "Blog", href: "/blog" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  footerGroups: [
    {
      title: "Company",
      links: [
        { label: "About", href: "/about" },
        { label: "Projects", href: "/projects" },
        { label: "Blog", href: "/blog" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "Solutions",
      links: [
        { label: "Services", href: "/services" },
        { label: "Shop", href: "/shop" },
        { label: "Get a Quote", href: "/quote" },
      ],
    },
  ],
};

// ── Blog taxonomy (seeded only when empty — staff manage these in the admin) ──

export const seedBlogCategories = [
  { name: "Insights", slug: "insights", description: "Perspectives and analysis from the METNMAT team." },
  { name: "Materials", slug: "materials", description: "Metallurgy and materials science." },
  { name: "R&D", slug: "r-d", description: "Research and development practice." },
  { name: "Electrochemistry", slug: "electrochemistry", description: "Electrodes, cells, electrolyzers and fuel cells." },
  { name: "Hydrogen & Fuel Cells", slug: "hydrogen-fuel-cells", description: "Hydrogen production, storage and fuel-cell systems." },
  { name: "Lab Equipment", slug: "lab-equipment", description: "Instruments, setups and experimental methods." },
];

export const seedBlogContentTypes = [
  { name: "Technical Article", slug: "technical-article" },
  { name: "Research Note", slug: "research-note" },
  { name: "Engineering Guide", slug: "engineering-guide" },
  { name: "Case Study", slug: "case-study" },
  { name: "Industry Insight", slug: "industry-insight" },
  { name: "Product Application", slug: "product-application" },
  { name: "Experimental Method", slug: "experimental-method" },
  { name: "Review Article", slug: "review-article" },
  { name: "Project Update", slug: "project-update" },
  { name: "Company Update", slug: "company-update" },
];
