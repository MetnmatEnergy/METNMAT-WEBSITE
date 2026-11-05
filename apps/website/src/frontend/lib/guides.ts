/**
 * Comparison guides (/guides/<slug>): the questions researchers ask before they
 * buy, answered plainly. Answer engines quote pages that state a direct answer
 * and a comparison table, and none of the competitor pages read had these.
 *
 * Standard electrochemistry only, with no figures for METNMAT's own products.
 * These live in code rather than the CMS so that they ship with the site, without
 * the blog pipeline and its staff emails.
 */
export type GuideSection = {
  h2: string;
  text?: string[];
  list?: string[];
  table?: { head: string[]; rows: string[][]; caption: string };
};

export type Guide = {
  title: string;
  h1: string;
  description: string;
  /** The direct answer, first thing on the page. */
  answer: string;
  sections: GuideSection[];
  faqs: { q: string; a: string }[];
  links: { href: string; name: string }[];
  keywords: string[];
};

export const GUIDES_UPDATED = "2026-11-05";

export const GUIDES: Record<string, Guide> = {
  "reference-electrode-comparison": {
    title: "Ag/AgCl vs SCE vs Hg/HgO: Which Reference Electrode?",
    h1: "Ag/AgCl vs SCE vs Hg/HgO: Which Reference Electrode Should You Use?",
    description: "Compare Ag/AgCl, saturated calomel, Hg/HgO, Hg/Hg₂SO₄ and Ag/Ag⁺ reference electrodes: potentials, which electrolyte each suits, and common mistakes.",
    answer:
      "Choose by electrolyte. Use Ag/AgCl or a saturated calomel electrode in neutral and acidic solutions, Hg/HgO in alkaline solutions such as KOH, Hg/Hg₂SO₄ where chloride must stay out of the cell, and Ag/Ag⁺ in organic solvents.",
    sections: [
      {
        h2: "Reference electrodes compared",
        table: {
          caption: "Common reference electrodes compared",
          head: ["Electrode", "Potential vs SHE (25 °C)", "Best for", "Avoid in"],
          rows: [
            ["Ag/AgCl (saturated KCl)", "+0.197 V", "Neutral and acidic aqueous solutions", "Strong alkali; cells where chloride harms the work"],
            ["Saturated calomel (SCE)", "+0.241 V", "Aqueous work and corrosion testing", "Hot solutions; labs avoiding mercury"],
            ["Hg/HgO (1 M KOH)", "+0.098 V", "Alkaline solutions such as KOH and NaOH", "Acidic solutions"],
            ["Hg/Hg₂SO₄ (saturated K₂SO₄)", "+0.64 V", "Sulfuric acid; chloride-free work", "Alkaline solutions"],
            ["Ag/Ag⁺", "Depends on solvent and salt", "Organic solvents such as acetonitrile", "Aqueous solutions"],
          ],
        },
      },
      {
        h2: "Three questions that decide it",
        list: [
          "What is the pH? Alkaline electrolytes call for Hg/HgO. Acidic and neutral ones can use Ag/AgCl or SCE.",
          "Can chloride reach your cell? If a trace of chloride would harm the catalyst or the metal under test, use Hg/Hg₂SO₄ or Hg/HgO.",
          "Is the electrolyte water? For organic solvents, use a non-aqueous Ag/Ag⁺ reference, so that no water enters the cell.",
        ],
      },
      {
        h2: "Reporting your potentials",
        text: [
          "Papers on electrocatalysis usually report potentials against the reversible hydrogen electrode (RHE), so that results at different pH can be compared. At 25 °C, E(RHE) = E(measured) + E(reference vs SHE) + 0.0592 × pH. The potential converter does this sum for you.",
          "Always state the reference electrode and its filling solution. An Ag/AgCl electrode in 3 M KCl sits at about +0.210 V, not +0.197 V, so leaving this out makes a result hard to reproduce.",
        ],
      },
      {
        h2: "Common mistakes",
        list: [
          "Using Ag/AgCl in strong KOH, where it is not the best choice.",
          "Letting the tip dry out. Store it in its filling solution.",
          "Leaving an air bubble at the tip, which breaks the connection and makes the reading noisy.",
          "Never checking it. Compare it now and then with a reference kept only for that purpose: a shift of more than a few millivolts means it needs attention.",
        ],
      },
    ],
    faqs: [
      {
        q: "Which reference electrode is best for KOH?",
        a: "Hg/HgO. It is built for alkaline electrolytes, and it is the usual reference for alkaline water electrolysis and AEM studies.",
      },
      {
        q: "Is Ag/AgCl better than a calomel electrode?",
        a: "For most aqueous work the two are interchangeable. Ag/AgCl contains no mercury and is simpler to handle, while SCE has a long history in corrosion work.",
      },
      {
        q: "Which reference electrode has no chloride?",
        a: "Hg/Hg₂SO₄ and Hg/HgO use no chloride in their filling solutions, so they suit chloride-sensitive work.",
      },
    ],
    links: [
      { href: "/shop/c/reference-electrodes", name: "All reference electrodes" },
      { href: "/shop/t/ag-agcl-reference-electrodes", name: "Ag/AgCl reference electrodes" },
      { href: "/shop/t/hg-hgo-reference-electrodes", name: "Hg/HgO reference electrodes" },
      { href: "/tools/potential-converter", name: "Potential converter" },
    ],
    keywords: ["Ag/AgCl vs SCE", "which reference electrode", "reference electrode comparison", "Hg/HgO vs Ag/AgCl", "reference electrode for KOH"],
  },

  "pem-vs-aem-electrolysis": {
    title: "PEM vs AEM Electrolyzers: Differences Explained",
    h1: "PEM vs AEM Electrolyzers: What Is the Difference?",
    description: "How PEM and AEM water electrolyzers differ: the ion carried, the electrolyte, catalysts, materials and maturity, with a comparison table.",
    answer:
      "A PEM electrolyzer carries protons through an acidic membrane and needs precious-metal catalysts such as iridium and platinum. An AEM electrolyzer carries hydroxide ions through an alkaline membrane, which allows cheaper catalysts, but the technology is younger and its membranes are less durable.",
    sections: [
      {
        h2: "PEM, AEM and alkaline electrolysis compared",
        table: {
          caption: "PEM, AEM and liquid alkaline water electrolysis compared",
          head: ["", "PEM", "AEM", "Liquid alkaline"],
          rows: [
            ["Ion carried", "Proton (H⁺)", "Hydroxide (OH⁻)", "Hydroxide (OH⁻)"],
            ["Separator", "Proton exchange membrane", "Anion exchange membrane", "Porous diaphragm"],
            ["Feed", "Pure water", "Pure water or dilute alkali", "Concentrated KOH"],
            ["Typical catalysts", "Iridium and platinum", "Nickel-based and other non-noble metals possible", "Nickel-based"],
            ["Maturity", "Commercial", "Developing", "Most established"],
            ["Main challenge", "Cost of precious metals", "Membrane durability", "Lower current density"],
          ],
        },
      },
      {
        h2: "Which one should a lab study?",
        list: [
          "Choose PEM to work with an established device and materials such as PFSA membranes.",
          "Choose AEM to explore cheaper catalysts and newer membranes, where much of the open research lies.",
          "In either case, test at device level with a zero-gap cell once the catalyst works in a three-electrode cell.",
        ],
      },
      {
        h2: "What you need to test each",
        text: [
          "For PEM work: a PFSA proton exchange membrane, a PFSA ionomer for the catalyst layer, and hardware with corrosion-resistant parts such as titanium on the anode side.",
          "For AEM work: an anion exchange membrane, a matching anion ionomer, and hardware that suits alkaline conditions, often with nickel on the anode side.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why does a PEM electrolyzer need iridium?",
        a: "Its anode runs at high potential in an acidic environment, and iridium oxide is the catalyst that survives those conditions while staying active.",
      },
      {
        q: "Can an AEM electrolyzer run on pure water?",
        a: "It can, but many systems feed dilute KOH because this gives better performance and durability today.",
      },
    ],
    links: [
      { href: "/shop/t/pem-electrolyzers", name: "PEM electrolyzers" },
      { href: "/shop/p/pem-hydrogen-electrolyzer-60-ml-min", name: "PEM hydrogen electrolyzer, 60 mL/min" },
      { href: "/shop/c/pem-membranes", name: "Proton exchange membranes" },
      { href: "/shop/c/aem-membranes", name: "Anion exchange membranes" },
      { href: "/shop/t/fumasep-membranes", name: "Fumasep membranes" },
      { href: "/shop/c/water-splitting-reactors", name: "Water splitting reactors" },
      { href: "/shop/c/consumables", name: "Ionomer dispersions" },
    ],
    keywords: ["PEM vs AEM", "AEM electrolyzer", "PEM electrolyzer", "difference between PEM and AEM electrolysis", "anion exchange membrane water electrolysis"],
  },

  "h-cell-vs-flow-cell": {
    title: "H-Cell vs Flow Cell for CO₂ Reduction",
    h1: "H-Cell vs Gas Diffusion Flow Cell for CO₂ Reduction",
    description: "When to use an H-cell, a gas diffusion flow cell or a zero-gap electrolyzer for CO₂ electroreduction, with a comparison of what each is good for.",
    answer:
      "Use an H-cell for fast, low-cost screening of catalysts. Move to a gas diffusion flow cell when you need high current density, because CO₂ dissolves poorly in water and limits an H-cell. Use a zero-gap electrolyzer to test how a catalyst behaves in a device.",
    sections: [
      {
        h2: "The three cell types compared",
        table: {
          caption: "H-cell, flow cell and zero-gap electrolyzer for CO₂ reduction",
          head: ["", "H-cell", "Gas diffusion flow cell", "Zero-gap electrolyzer"],
          rows: [
            ["How CO₂ arrives", "Dissolved in electrolyte", "As gas, through a gas diffusion electrode", "As gas, through a gas diffusion electrode"],
            ["Current density", "Low, limited by dissolved CO₂", "High", "High"],
            ["Best for", "Catalyst screening", "Testing catalysts at practical rates", "Testing as a device"],
            ["Setup effort", "Lowest", "Moderate", "Highest"],
            ["Main problem", "Low current", "Electrode flooding", "Salt build-up, water balance"],
          ],
        },
      },
      {
        h2: "Why an H-cell runs out of CO₂",
        text: [
          "CO₂ dissolves in water at only about 33 millimoles per litre at 25 °C and 1 atmosphere. In an H-cell, the catalyst can only use CO₂ that reaches it through the liquid, so the current levels off at a low value however good the catalyst is.",
          "A gas diffusion electrode solves this by bringing the gas right up to the catalyst through a porous layer, leaving only a very thin film of liquid to cross.",
        ],
      },
      {
        h2: "A sensible order of work",
        list: [
          "Screen catalysts in an H-cell, where runs are quick and cheap.",
          "Move the best ones to a gas diffusion flow cell, to see how they behave at high current.",
          "Test the winner in a zero-gap electrolyzer with an anion exchange membrane.",
        ],
      },
    ],
    faqs: [
      {
        q: "What membrane goes in a CO₂ reduction H-cell?",
        a: "Proton exchange and anion exchange membranes are both used. Choose by your electrolyte, and by which products must not cross to the other side.",
      },
      {
        q: "What is flooding in a gas diffusion electrode?",
        a: "Electrolyte seeping into the pores of the electrode and blocking the gas, which cuts performance. It is the commonest failure in flow cells.",
      },
    ],
    links: [
      { href: "/shop/c/h-cell", name: "H-cells" },
      { href: "/shop/c/co2-electrolysis", name: "CO₂ electrolyzers and flow cells" },
      { href: "/shop/c/aem-membranes", name: "Anion exchange membranes" },
      { href: "/shop/c/carbon-gdl", name: "Gas diffusion layers" },
    ],
    keywords: ["H-cell vs flow cell", "CO2 reduction flow cell", "CO2 reduction H cell", "gas diffusion electrode flow cell", "zero gap CO2 electrolyzer"],
  },

  "three-electrode-cell-setup": {
    title: "How to Set Up a Three-Electrode Cell",
    h1: "How to Set Up a Three-Electrode Electrochemical Cell",
    description: "Step-by-step three-electrode cell setup: what the working, reference and counter electrodes do, how to place them, and the mistakes that spoil a measurement.",
    answer:
      "A three-electrode cell uses a working electrode where the reaction happens, a reference electrode that fixes the potential scale, and a counter electrode that carries the current. Place the reference close to the working electrode, use a counter electrode larger than the working electrode, and clean everything first.",
    sections: [
      {
        h2: "What each electrode does",
        table: {
          caption: "The three electrodes and their roles",
          head: ["Electrode", "Job", "Common choices"],
          rows: [
            ["Working", "Where the reaction under study happens", "Glassy carbon, gold, platinum disks; your own sample in a holder"],
            ["Reference", "Fixes the potential scale; carries almost no current", "Ag/AgCl, SCE, Hg/HgO"],
            ["Counter", "Carries the current", "Platinum wire or mesh; graphite rod"],
          ],
        },
      },
      {
        h2: "Step by step",
        list: [
          "Clean the cell and rinse it with deionised water.",
          "Polish the working electrode and rinse it well.",
          "Fill the cell with electrolyte, and purge with gas if oxygen would interfere.",
          "Place the reference electrode close to the working electrode, to reduce the resistance between them.",
          "Place the counter electrode so that the current reaches the working electrode evenly.",
          "Connect the potentiostat leads, then check the open-circuit potential before you start.",
        ],
      },
      {
        h2: "Mistakes that spoil a measurement",
        list: [
          "A counter electrode smaller than the working electrode, which limits the current.",
          "A reference electrode far from the working electrode, which adds a voltage error at high current.",
          "Air bubbles on an electrode surface.",
          "Using platinum as the counter electrode in hydrogen evolution catalyst studies, where it can deposit on the sample.",
          "Forgetting to correct for solution resistance (iR compensation) at high current.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why use three electrodes instead of two?",
        a: "In a two-electrode cell, the current flows through the same electrode that sets the reference, so the potential drifts. A third electrode separates the two jobs, which gives an accurate potential.",
      },
      {
        q: "How close should the reference electrode be?",
        a: "As close as practical to the working electrode without touching it or blocking the current. Many cells use a Luggin capillary for this.",
      },
    ],
    links: [
      { href: "/shop/c/electrodes", name: "All electrodes" },
      { href: "/shop/c/reactor-cell", name: "Electrochemical cells" },
      { href: "/guides/reference-electrode-comparison", name: "Which reference electrode?" },
      { href: "/tools/potential-converter", name: "Potential converter" },
    ],
    keywords: ["three electrode cell setup", "three electrode system", "how to set up electrochemical cell", "working reference counter electrode"],
  },

  "how-to-clean-electrodes": {
    title: "How to Clean Glassy Carbon and Platinum Electrodes",
    h1: "How to Clean Glassy Carbon and Platinum Electrodes",
    description: "How to polish a glassy carbon electrode, clean a platinum electrode and store an Ag/AgCl reference electrode, using the steps labs commonly follow.",
    answer:
      "Polish a glassy carbon electrode on a wet cloth with alumina slurry, then rinse it well. Clean a platinum electrode by rinsing it, then soaking it in dilute acid or cycling it in dilute sulfuric acid. Keep the tip of an Ag/AgCl reference electrode in its filling solution. Where your own protocol differs, follow your protocol.",
    sections: [
      {
        h2: "How to clean a glassy carbon electrode",
        list: [
          "Wet a polishing cloth on a flat surface and add a little alumina slurry.",
          "Move the electrode in a figure of eight, holding it upright with light, even pressure.",
          "Work down in grit if the surface is scratched, for example from 1 µm to 0.3 µm and then 0.05 µm alumina.",
          "Rinse well with deionised water, so that no alumina stays on the surface.",
          "If the body allows it, sonicate briefly in deionised water or ethanol, then rinse again.",
          "Check the surface with a cyclic voltammogram of a known redox couple, such as ferricyanide.",
        ],
      },
      {
        h2: "How to clean a platinum electrode",
        text: ["The same steps suit platinum wire, mesh, sheet and disk counter or working electrodes, except that only a disk is polished."],
        list: [
          "Rinse with deionised water to remove electrolyte.",
          "For light contamination, soak in dilute nitric acid, then rinse well.",
          "For an electrochemically clean surface, cycle the potential in dilute sulfuric acid until the voltammogram stops changing.",
          "Flame cleaning suits bare platinum only. Never flame an electrode with a PTFE or PEEK body.",
        ],
      },
      {
        h2: "How to store an Ag/AgCl reference electrode",
        list: [
          "Keep the tip in a storage solution that matches the filling solution, usually KCl of the same strength.",
          "Do not store it in deionised water: chloride leaches out and the potential drifts.",
          "Never let the junction dry out. Top up the filling solution when the level drops.",
          "Check it now and then against a reference electrode kept only for that purpose.",
        ],
      },
      {
        h2: "Cleaning at a glance",
        table: {
          caption: "How to clean common electrodes",
          head: ["Electrode", "Clean with", "Avoid"],
          rows: [
            ["Glassy carbon", "Alumina slurry on a polishing cloth", "Coarse abrasives and leaving alumina on the surface"],
            ["Platinum", "Rinsing, dilute acid, or cycling in dilute sulfuric acid", "Bending thin wire or mesh, and flame on polymer bodies"],
            ["Gold", "Alumina polish, then cycling in dilute sulfuric acid", "Hard scrubbing: gold is soft"],
            ["Ag/AgCl", "Rinse the outside only, and refresh the filling solution", "Drying out and storing in deionised water"],
          ],
        },
      },
    ],
    faqs: [
      {
        q: "How often should I polish a glassy carbon electrode?",
        a: "Before each experiment, or whenever the voltammogram changes shape. A fouled surface shows up as wider peak separation and lower peak current.",
      },
      {
        q: "What solution should I store an Ag/AgCl electrode in?",
        a: "One that matches its filling solution, usually KCl of the same strength. Storing it in deionised water shifts its potential.",
      },
      {
        q: "Can I clean a platinum counter electrode with acid?",
        a: "Yes. Dilute nitric acid is a common choice, and cycling in dilute sulfuric acid is the usual way to get an electrochemically clean surface.",
      },
    ],
    links: [
      { href: "/shop/t/glassy-carbon-electrodes", name: "Glassy carbon electrodes" },
      { href: "/shop/t/platinum-electrodes", name: "Platinum electrodes" },
      { href: "/shop/t/ag-agcl-reference-electrodes", name: "Ag/AgCl reference electrodes" },
      { href: "/shop/c/working-electrodes", name: "Working electrodes" },
      { href: "/shop/c/counter-electrodes", name: "Counter electrodes" },
      { href: "/shop/c/reference-electrodes", name: "Reference electrodes" },
    ],
    keywords: ["how to clean glassy carbon electrode", "how to polish glassy carbon electrode", "how to clean platinum electrode", "how to clean platinum counter electrode", "ag/agcl electrode storage solution"],
  },

  "working-counter-reference-electrodes": {
    title: "Working, Counter and Reference Electrodes Explained",
    h1: "Working, Counter and Reference Electrodes Explained",
    description: "What the working, counter and reference electrodes each do, with examples of every type, and how they are used in cyclic voltammetry.",
    answer:
      "The working electrode is where the reaction you study takes place. The reference electrode holds a steady potential to measure against and carries almost no current. The counter electrode, also called the auxiliary electrode, carries the current so that the reference stays undisturbed.",
    sections: [
      {
        h2: "The three electrodes at a glance",
        table: {
          caption: "What each electrode does, with examples",
          head: ["Electrode", "What it does", "Examples"],
          rows: [
            ["Working", "Hosts the reaction under study", "Glassy carbon, gold and platinum disks; a sample in a holder"],
            ["Counter (auxiliary)", "Completes the circuit and carries the current", "Platinum wire, mesh or sheet; graphite rod"],
            ["Reference", "Sets the potential scale", "Ag/AgCl, saturated calomel, Hg/HgO, Hg/Hg₂SO₄"],
          ],
        },
      },
      {
        h2: "Types of reference electrode",
        table: {
          caption: "Common reference electrodes and where they suit",
          head: ["Reference electrode", "Usual electrolyte"],
          rows: [
            ["Ag/AgCl", "Neutral and acidic aqueous solutions"],
            ["Saturated calomel (SCE)", "Neutral and acidic aqueous solutions"],
            ["Hg/HgO", "Alkaline solutions such as KOH and NaOH"],
            ["Hg/Hg₂SO₄", "Sulfuric acid and other chloride-free solutions"],
            ["Ag/Ag⁺", "Non-aqueous solvents"],
          ],
        },
      },
      {
        h2: "The working electrode in cyclic voltammetry",
        text: [
          "In cyclic voltammetry, the potentiostat sweeps the potential of the working electrode against the reference and records the current that flows between the working and counter electrodes.",
          "The working electrode must be clean and of a known area, because current density is the current divided by that area.",
        ],
      },
      {
        h2: "Choosing a counter electrode",
        list: [
          "Give it more surface than the working electrode, so that it does not limit the current.",
          "Choose a material that stays inert in your electrolyte.",
          "In hydrogen evolution studies, consider graphite: platinum can dissolve and redeposit on the working electrode.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the difference between a counter electrode and a reference electrode?",
        a: "The counter electrode carries the current. The reference electrode carries almost none, which is what keeps its potential steady.",
      },
      {
        q: "Is a counter electrode the same as an auxiliary electrode?",
        a: "Yes. They are two names for the same electrode.",
      },
      {
        q: "What is an example of a reference electrode?",
        a: "Ag/AgCl is the most widely used. Saturated calomel suits similar solutions, and Hg/HgO suits alkaline ones.",
      },
    ],
    links: [
      { href: "/shop/c/working-electrodes", name: "Working electrodes" },
      { href: "/shop/c/counter-electrodes", name: "Counter electrodes" },
      { href: "/shop/c/reference-electrodes", name: "Reference electrodes" },
      { href: "/guides/reference-electrode-comparison", name: "Which reference electrode?" },
      { href: "/guides/three-electrode-cell-setup", name: "Set up a three-electrode cell" },
    ],
    keywords: ["counter electrode and reference electrode", "working electrode in cyclic voltammetry", "counter electrode examples", "reference electrode types", "what is reference electrode give example"],
  },

  "ion-exchange-membrane-types": {
    title: "Types of Ion Exchange Membrane: PEM, AEM, CEM, BPM",
    h1: "Types of Ion Exchange Membrane",
    description: "The main ion exchange membranes compared: proton exchange, anion exchange, cation exchange and bipolar, with what each one carries and where it is used.",
    answer:
      "An ion exchange membrane lets ions of one charge pass and blocks those of the other. A cation exchange membrane passes positive ions, and a proton exchange membrane is one that passes protons. An anion exchange membrane passes negative ions such as hydroxide. A bipolar membrane joins the two and splits water at the junction.",
    sections: [
      {
        h2: "The four types compared",
        table: {
          caption: "Ion exchange membrane types",
          head: ["Type", "What it carries", "Typical use"],
          rows: [
            ["Proton exchange (PEM)", "Protons (H⁺)", "PEM fuel cells and water electrolyzers"],
            ["Anion exchange (AEM)", "Negative ions such as OH⁻", "Alkaline membrane electrolyzers and CO₂ electrolysis"],
            ["Cation exchange (CEM)", "Positive ions such as Na⁺", "Electrodialysis and separated cells"],
            ["Bipolar (BPM)", "Splits water into H⁺ and OH⁻", "Acid and base production, and CO₂ electrolysis"],
          ],
        },
      },
      {
        h2: "What to compare between membranes",
        list: [
          "Thickness: a thinner membrane has lower resistance but is weaker and lets more gas cross.",
          "Ion exchange capacity: how many charged groups the polymer holds.",
          "Reinforcement: a reinforced membrane is stronger and easier to handle.",
          "Stability: check it against your electrolyte, pH and temperature.",
          "Ionic form: many are supplied in one form and must be exchanged before use.",
        ],
      },
      {
        h2: "Which membrane for which cell",
        text: [
          "Acidic cells usually use a proton exchange membrane, and alkaline cells an anion exchange membrane. Separating two liquids in an H-cell needs one that keeps the products apart without adding much resistance.",
          "Check what the maker says about conditioning, because many membranes need soaking or ion exchange before first use.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the difference between PEM and CEM?",
        a: "A proton exchange membrane is a kind of cation exchange membrane. PEM is the name used when the ion it carries is the proton, as in fuel cells and electrolyzers.",
      },
      {
        q: "What does a bipolar membrane do?",
        a: "It joins an anion exchange layer to a cation exchange layer. Under the right bias, water splits at the junction into H⁺ and OH⁻.",
      },
      {
        q: "What is a PFSA membrane?",
        a: "A perfluorosulfonic acid membrane, the most common type of proton exchange membrane.",
      },
    ],
    links: [
      { href: "/shop/c/membranes", name: "All membranes" },
      { href: "/shop/c/pem-membranes", name: "Proton exchange membranes" },
      { href: "/shop/c/aem-membranes", name: "Anion exchange membranes" },
      { href: "/shop/c/cem-membranes", name: "Cation exchange membranes" },
      { href: "/shop/c/bipolar-membranes", name: "Bipolar membranes" },
      { href: "/shop/t/fumasep-membranes", name: "Fumasep membranes" },
    ],
    keywords: ["ion exchange membrane types", "types of ion exchange membrane", "ion exchange membrane price", "difference between pem and aem", "what is a bipolar membrane"],
  },

  "gas-diffusion-electrode": {
    title: "What Is a Gas Diffusion Electrode (GDE)?",
    h1: "What Is a Gas Diffusion Electrode?",
    description: "How a gas diffusion electrode works, what its layers do, why CO₂ reduction cells use one, and how to choose a gas diffusion layer for it.",
    answer:
      "A gas diffusion electrode, or GDE, is a porous electrode that brings a gas straight to the catalyst from one side while the electrolyte touches it from the other. This reaches far higher current densities than a gas dissolved in liquid, so GDEs are used in fuel cells, electrolyzers and CO₂ reduction cells.",
    sections: [
      {
        h2: "The layers of a gas diffusion electrode",
        table: {
          caption: "What each layer of a GDE does",
          head: ["Layer", "What it does"],
          rows: [
            ["Gas diffusion layer", "A porous carbon paper or cloth that spreads the gas and conducts electrons"],
            ["Microporous layer", "A fine layer that smooths the surface and manages water"],
            ["Catalyst layer", "Where the reaction happens, where gas, electrolyte and catalyst meet"],
          ],
        },
      },
      {
        h2: "Why CO₂ reduction uses a gas diffusion electrode",
        text: [
          "CO₂ dissolves poorly in water, so in an H-cell the current is limited by how fast it reaches the catalyst. A gas diffusion electrode feeds CO₂ as a gas, so the path to the catalyst is very short.",
          "This is why gas diffusion flow cells reach current densities that an H-cell cannot.",
        ],
      },
      {
        h2: "What goes wrong: flooding",
        list: [
          "Flooding happens when electrolyte fills the pores and blocks the gas.",
          "Common causes are a pressure imbalance, a hydrophilic surface and salt building up in the pores.",
          "Watch the gas side for liquid, and for a fall in the product you want.",
        ],
      },
      {
        h2: "How to choose a gas diffusion layer",
        list: [
          "Thickness and porosity affect how easily the gas passes.",
          "A hydrophobic treatment, often PTFE, helps resist flooding.",
          "A microporous layer gives a smoother base for the catalyst.",
          "The material must survive your electrolyte and potential.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the difference between a GDE and a GDL?",
        a: "The gas diffusion layer is the porous support. A gas diffusion electrode is that support with a catalyst layer on it.",
      },
      {
        q: "Can I use a gas diffusion electrode in an H-cell?",
        a: "Not as intended. It needs a gas chamber behind it, which is what a gas diffusion flow cell provides.",
      },
    ],
    links: [
      { href: "/shop/c/carbon-gdl", name: "Gas diffusion layers" },
      { href: "/shop/c/co2-electrolysis", name: "CO₂ electrolyzers and flow cells" },
      { href: "/guides/h-cell-vs-flow-cell", name: "H-cell or flow cell?" },
    ],
    keywords: ["gas diffusion electrode", "gas diffusion electrode co2 reduction", "gas diffusion electrode gde", "gas diffusion layer", "what is a gas diffusion electrode"],
  },
};

/** The guides that discuss a category, for the links on its pages. */
export const guidesForCategory = (category: string) =>
  Object.entries(GUIDES)
    .filter(([, g]) => g.links.some((l) => l.href === `/shop/c/${category}`))
    .map(([slug, g]) => ({ href: `/guides/${slug}`, name: g.title }));
