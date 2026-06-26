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

export const seedPosts = [
  { slug: "iacs-oxygen-free-copper", title: "Achieving 91–93% IACS in oxygen-free copper alloys", category: "Insights", readingTime: "5 min read", publishedDate: "2026-01-15", excerpt: "How alloying, rapid quenching, de-oxidation and aging combine to deliver high-conductivity, high-strength copper." },
  { slug: "microstructure-heat-treatment", title: "Controlling microstructure through heat treatment", category: "Materials", readingTime: "4 min read", publishedDate: "2026-02-10", excerpt: "Tuning volume fraction, morphology and phase distribution to get the properties your application needs." },
  { slug: "why-benchmarking-accelerates-rd", title: "Why product benchmarking accelerates R&D", category: "R&D", readingTime: "3 min read", publishedDate: "2026-03-05", excerpt: "Comparing against market competitors is the fastest way to find where to focus development effort." },
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
