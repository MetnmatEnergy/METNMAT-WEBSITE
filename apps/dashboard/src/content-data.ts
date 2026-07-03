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

export const seedProjects = [
  { slug: "oxygen-free-copper-alloy", title: "Oxygen-free high-strength electrical copper alloy", category: "Alloy Development", summary: "Alloying, rapid quenching, de-oxidation, 60–90% cold reduction and aging to reach 91–93% IACS conductivity." },
  { slug: "microstructure-optimization", title: "Multi-phase microstructure optimization", category: "Heat Treatment", summary: "Tuned volume fraction, morphology and phase distribution through controlled heat treatment." },
  { slug: "process-cost-reduction", title: "Process cost & quality improvement", category: "Process Improvement", summary: "Identified and eliminated defects to cut cost and lift quality across the production line." },
  { slug: "competitive-benchmarking", title: "Competitive product benchmarking", category: "Benchmarking", summary: "Benchmarked a client's product against market competitors to guide the development roadmap." },
  { slug: "prototype-to-scale-up", title: "Lab prototype to industrial scale-up", category: "Process Development", summary: "Took a validated lab-scale prototype through to reliable industrial-scale production." },
  { slug: "process-modeling-simulation", title: "Process design via modeling & simulation", category: "Simulation", summary: "Used advanced simulation to design and de-risk a new process before committing capital." },
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
];

export const seedFaqs = [
  { question: "What does METNMAT Research & Innovations do?", answer: "METNMAT is India's first private metallurgy & materials R&D company. We deliver customized turnkey solutions — from lab-scale prototype to full industrial scale — across product and process development, applied research, benchmarking, heat treatment and simulation." },
  { question: "What products can I buy from METNMAT?", answer: "Our shop offers lab-grade electrochemistry equipment: electrodes (reference, counter and working), ion-exchange membranes (PEM, AEM, bipolar and cation), electrochemical cells & reactors, lab equipment (peristaltic pumps, MEA fabrication presses, specialised research setups) and accessories — with bulk B2B pricing and GST invoicing." },
  { question: "Do you ship across India and worldwide?", answer: "Yes. We ship across India and worldwide, with a GST invoice provided on every order." },
  { question: "Can I request a customized product?", answer: "Yes. Use the 'Request for Customization' option on any product to share your design, size, material and quantity — you can also attach PDFs or photos — and our team will get back to you with a quote." },
  { question: "What is your oxygen-free high-strength copper alloy?", answer: "It is a copper alloy developed by METNMAT using alloying, rapid quenching, de-oxidation, 60–90% cold reduction and aging treatment to achieve 91–93% IACS electrical conductivity together with high strength." },
];

export const seedHomepage = {
  eyebrow: "India's first private Metallurgy & Materials R&D",
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
