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

// Case studies / projects (grounded in METNMAT's described capabilities).
export const projects: Project[] = [
  {
    slug: "oxygen-free-copper-alloy",
    title: "Oxygen-free high-strength electrical copper alloy",
    category: "Alloy Development",
    summary:
      "Alloying, rapid quenching, de-oxidation, 60–90% cold reduction and aging to reach 91–93% IACS conductivity.",
  },
  {
    slug: "microstructure-optimization",
    title: "Multi-phase microstructure optimization",
    category: "Heat Treatment",
    summary:
      "Tuned volume fraction, morphology and phase distribution through controlled heat treatment.",
  },
  {
    slug: "process-cost-reduction",
    title: "Process cost & quality improvement",
    category: "Process Improvement",
    summary:
      "Identified and eliminated defects to cut cost and lift quality across the production line.",
  },
  {
    slug: "competitive-benchmarking",
    title: "Competitive product benchmarking",
    category: "Benchmarking",
    summary:
      "Benchmarked a client's product against market competitors to guide the development roadmap.",
  },
  {
    slug: "prototype-to-scale-up",
    title: "Lab prototype to industrial scale-up",
    category: "Process Development",
    summary:
      "Took a validated lab-scale prototype through to reliable industrial-scale production.",
  },
  {
    slug: "process-modeling-simulation",
    title: "Process design via modeling & simulation",
    category: "Simulation",
    summary:
      "Used advanced simulation to design and de-risk a new process before committing capital.",
  },
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

// Insights / news (topics tied to METNMAT's expertise).
export const blogPosts: BlogPost[] = [
  {
    slug: "iacs-oxygen-free-copper",
    title: "Achieving 91–93% IACS in oxygen-free copper alloys",
    excerpt:
      "How alloying, rapid quenching, de-oxidation and aging combine to deliver high-conductivity, high-strength copper.",
    category: "Insights",
    date: "2026-01-15",
    readingTime: "5 min read",
  },
  {
    slug: "microstructure-heat-treatment",
    title: "Controlling microstructure through heat treatment",
    excerpt:
      "Tuning volume fraction, morphology and phase distribution to get the properties your application needs.",
    category: "Materials",
    date: "2026-02-10",
    readingTime: "4 min read",
  },
  {
    slug: "why-benchmarking-accelerates-rd",
    title: "Why product benchmarking accelerates R&D",
    excerpt:
      "Comparing against market competitors is the fastest way to find where to focus development effort.",
    category: "R&D",
    date: "2026-03-05",
    readingTime: "3 min read",
  },
];
