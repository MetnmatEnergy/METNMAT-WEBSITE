/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PLACEHOLDER CONTENT — REPLACE PER TAB                                     │
 * │                                                                           │
 * │  Nothing here is real company data. It exists only so the layout renders. │
 * │  As the company hands you real content, edit the arrays below (or later   │
 * │  swap this file for data fetched from Payload CMS / the Website API).      │
 * │  Search for "TODO(content)" to find every spot that needs real data.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

export type Stat = { value: string; label: string };
export type Client = { name: string; logo: string };
export type Service = { slug: string; title: string; summary: string; icon?: string };
export type Project = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  subtitle?: string;
  client?: string;
  year?: number;
  featured?: boolean;
  tags?: string[];
  highlights?: { label: string; value: string }[];
  coverUrl?: string;
  coverAlt?: string;
};
export type Product = {
  slug: string;
  name: string;
  category: string;
  blurb: string;
  price?: string;
};
export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string; // ISO
  readingTime: string;
};

/** Hero headline split so the last line can use the brand gradient. */
export const hero = {
  eyebrow: "India's first private Metallurgy & Materials R&D",
  titleLead: "Turning materials science into",
  titleAccent: "industrial advantage",
  subtitle:
    "Customized turnkey R&D solutions for metallurgy & materials industries — from lab-scale prototype to full industrial scale, making your process cheaper, cleaner and stronger.",
  primaryCta: { label: "Explore METNMAT", href: "/services" },
  secondaryCta: { label: "Shop Now", href: "/shop" },
};

export const stats: Stat[] = [
  { value: "100+", label: "R&D projects delivered" },
  { value: "2018", label: "Innovating since" },
  { value: "91–93%", label: "IACS conductivity" },
];

// Clients / partners (from the company site).
export const clients: Client[] = [
  { name: "Tata Steel", logo: "/clients/tata.png" },
  { name: "Vedanta", logo: "/clients/vedanta.png" },
  { name: "JSL", logo: "/clients/jsl.png" },
  { name: "Eastern Copper", logo: "/clients/eastern-copper.png" },
  { name: "Mescab Wires & Cables", logo: "/clients/mescab.png" },
];

// Colleges, universities & research labs METNMAT works with — shown as a sliding
// wall of named, full-colour logos. (Two source files excluded: a duplicate IIT
// Bombay and a generic clipart.)
export type EduLogo = { src: string; name: string };
export const eduLogos: EduLogo[] = [
  { src: "/clients/edu/edu-01.png", name: "IIT Bombay" },
  { src: "/clients/edu/edu-05.png", name: "IIT Hyderabad" },
  { src: "/clients/edu/edu-08.png", name: "IIT Patna" },
  { src: "/clients/edu/edu-25.png", name: "IIT Madras" },
  { src: "/clients/edu/edu-26.png", name: "IIT Kanpur" },
  { src: "/clients/edu/edu-27.png", name: "IIT (BHU) Varanasi" },
  { src: "/clients/edu/edu-28.png", name: "IIT Delhi" },
  { src: "/clients/edu/edu-19.png", name: "Indian Institute of Science" },
  { src: "/clients/edu/edu-11.png", name: "IISER Mohali" },
  { src: "/clients/edu/edu-16.png", name: "Manipal Academy of Higher Education" },
  { src: "/clients/edu/edu-10.png", name: "MNIT Jaipur" },
  { src: "/clients/edu/edu-14.png", name: "Birla Institute of Technology & Science" },
  { src: "/clients/edu/edu-07.png", name: "CSIR" },
  { src: "/clients/edu/edu-15.png", name: "University of Michigan" },
  { src: "/clients/edu/edu-20.png", name: "University of California, Irvine" },
  { src: "/clients/edu/edu-06.png", name: "University of Nottingham" },
  { src: "/clients/edu/edu-12.png", name: "University of Padova" },
  { src: "/clients/edu/edu-09.png", name: "University of Brescia" },
  { src: "/clients/edu/edu-23.png", name: "Linköping University" },
  { src: "/clients/edu/edu-29.png", name: "UNICAMP" },
  { src: "/clients/edu/edu-18.png", name: "Instituto Superior Técnico" },
  { src: "/clients/edu/edu-02.png", name: "Universiti Teknologi Malaysia" },
  { src: "/clients/edu/edu-22.png", name: "Universiti Malaysia Terengganu" },
  { src: "/clients/edu/edu-03.png", name: "American University of Sharjah" },
  { src: "/clients/edu/edu-30.png", name: "Sultan Qaboos University" },
  { src: "/clients/edu/edu-17.png", name: "Bu-Ali Sina University" },
];

// Services offered (METNMAT Research & Innovations).
export const services: Service[] = [
  {
    slug: "product-process-development",
    title: "Product & Process Development",
    summary:
      "We develop lab-scale prototypes and scale them up to full industrial-scale implementation.",
    icon: "rocket",
  },
  {
    slug: "applied-research-consultancy",
    title: "Applied Research & Consultancy",
    summary:
      "Turnkey industrial solutions that improve your processes in cost, quality and efficiency.",
    icon: "lightbulb",
  },
  {
    slug: "process-quality-improvement",
    title: "Process & Quality Improvement",
    summary:
      "Ongoing effort to identify and eliminate defects and errors across your production process.",
    icon: "gauge",
  },
  {
    slug: "product-benchmarking",
    title: "Product Benchmarking",
    summary:
      "Compare your products and services against market competitors to find the edge.",
    icon: "target",
  },
  {
    slug: "microstructure-heat-treatment",
    title: "Microstructure Control & Heat Treatment",
    summary:
      "Optimize multi-phase microstructure — volume fraction, morphology and phase distribution — through heat treatment.",
    icon: "flame",
  },
  {
    slug: "modeling-simulations",
    title: "Modeling & Simulations",
    summary:
      "Design and develop your process and product using advanced modeling and simulations.",
    icon: "cpu",
  },
  {
    slug: "materials-testing-characterization",
    title: "Materials Testing & Characterization",
    summary:
      "Mechanical, microstructural and compositional testing and characterization of your materials.",
    icon: "microscope",
  },
  {
    slug: "materials-processing-facilities",
    title: "Materials Processing Facilities",
    summary:
      "Advanced materials-processing equipment and facilities to develop, refine and scale your process.",
    icon: "factory",
  },
];

// Case studies / projects — offline fallback that mirrors the real CMS content
// (metnmat.in/projects) so pages render even when the CMS is unreachable.
export const projects: Project[] = [
  { slug: "microstructure-control-heat-treatment", title: "Microstructure Control & Heat Treatment", category: "Heat Treatment", summary: "Optimising multi-phase microstructure — volume fraction, morphology and phase distribution — through heat treatment to deliver the exact property balance an application needs." },
  { slug: "modeling-simulations", title: "Modeling & Simulations", category: "Simulation", summary: "Advanced modeling and simulation that helps industries take informed decisions, lower manufacturing costs and improve product quality." },
  { slug: "oxygen-free-copper-alloy", title: "Oxygen-Free High-Strength Electrical Copper Alloy", category: "Alloy Development", summary: "A copper alloy engineered to reach 91–93% IACS conductivity together with high strength." },
  { slug: "alumina-insulation-fiber-board", title: "High-Temperature Alumina Insulation Fiber Board", category: "High-Temperature Materials", summary: "Furnace-lining insulation fabricated to withstand ~1800°C with very low shrinkage and thermal conductivity." },
  { slug: "casting-yield-optimization", title: "Casting Yield Optimization", category: "Waste Heat Recovery", summary: "A thermoelectric system that recycles waste process heat to hold controlled temperatures during casting — improving quality and reducing defects." },
  { slug: "ferritic-stainless-steel-texture", title: "Texture Analysis of Ferritic Stainless-Steel Sheet", category: "Heat Treatment", summary: "Improving deep drawability by raising the r-value through recrystallisation-texture control via multistage thermo-mechanical processing." },
  { slug: "high-temperature-ceramic", title: "High-Temperature Ceramic", category: "High-Temperature Materials", summary: "Thermally stable ceramics that form a robust foundation for thermoelectric modules at elevated temperatures." },
  { slug: "aluminum-foam", title: "Lightweight & High-Strength Aluminum Foam", category: "Alloy Development", summary: "A melting-and-casting route to aluminum foam with high energy absorption and compressive strength at low density." },
  { slug: "composite-materials", title: "Composite Materials", category: "Composites", summary: "Composites engineered to optimise thermoelectric properties for improved energy-conversion efficiency, durability and flexibility." },
  { slug: "surface-casting-improvement", title: "Surface Casting Improvement", category: "Waste Heat Recovery", summary: "Thermoelectric waste-heat recycling applied to surface casting to cut energy use, costs and emissions." },
  { slug: "material-synthesis", title: "Material Synthesis", category: "Waste Heat Recovery", summary: "Advanced fabrication of thermoelectric materials with high electrical and low thermal conductivity for waste-heat-to-electricity conversion." },
  { slug: "new-aluminum-alloy", title: "New Aluminum Alloy Development", category: "Alloy Development", summary: "Custom aluminum alloys for transportation, aerospace and construction — tuned for strength, ductility and corrosion resistance." },
  { slug: "wear-resistant-composites", title: "Wear-Resistant Composite Materials", category: "Composites", summary: "Metal-matrix composites with selectable ceramics and reinforcements, tuned through interfacial bonding." },
  { slug: "waste-heat-recycling-system", title: "Advanced Solid-State Waste-Heat Recycling System", category: "Waste Heat Recovery", summary: "A thermoelectric system that turns lost process heat — 20–50% of manufacturing energy — back into usable energy." },
  { slug: "casting-defects", title: "Reducing Casting Defects in Metal", category: "Waste Heat Recovery", summary: "Thermoelectric waste-heat recycling that stabilises casting conditions to minimise defects for a more reliable process." },
];

// TODO(content): real products from the catalog (or fetch from API/Meilisearch).
export const products: Product[] = [
  { slug: "placeholder-product-1", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-2", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-3", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-4", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-5", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
  { slug: "placeholder-product-6", name: "Product Name", category: "Category", blurb: "Key spec · spec", price: "—" },
];

export const productCategories: string[] = [
  "All",
  "Electrodes",
  "Electrochemical Cells",
  "Accessories",
];

// Offline fallback for the real CMS-managed articles — shown ONLY when the CMS
// is unreachable, so titles/slugs mirror the published articles (never invent
// content here; the CMS is the source of truth).
export const blogPosts: BlogPost[] = [
  {
    slug: "ion-exchange-membranes",
    title: "Ion Exchange Membranes (IEM)",
    excerpt:
      "What ion exchange membranes are, how protons and hydroxide ions move through them, and the properties that decide which membrane fits your electrolyzer or fuel cell.",
    category: "Electrochemistry",
    date: "2026-07-03",
    readingTime: "3 min read",
  },
  {
    slug: "anion-exchange-membrane-water-electrolysis",
    title: "Anion Exchange Membrane Water Electrolysis (AEMWE)",
    excerpt:
      "How anion exchange membrane water electrolysis works — cell components, electrolyte choices and the four cell configurations — and why AEMWE is an economical route to green hydrogen.",
    category: "Hydrogen & Fuel Cells",
    date: "2026-07-03",
    readingTime: "3 min read",
  },
];
