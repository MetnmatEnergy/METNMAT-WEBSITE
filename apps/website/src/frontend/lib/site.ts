/**
 * Site-wide structural config (NOT page content).
 * Navigation, brand name, and contact placeholders live here so the chrome
 * (header/footer) renders. Replace the contact placeholders with real values.
 */
export const site = {
  name: "METNMAT",
  // Registered legal entity — used in Organization JSON-LD, OG siteName, footer,
  // Product "seller" and the Razorpay payment modal. The CMS `company.legalName`
  // global overrides this at runtime (see seed.ts) — keep both in sync.
  legalName: "METNMAT INNOVATIONS PRIVATE LIMITED",
  tagline: "Research. Design. Build. Scale.",
  url: "https://www.metnmat.com",
  description:
    "Metallurgy & materials R&D — lab-scale prototype to full industrial scale.",

  contact: {
    email: "contact@metnmat.com",
    email2: "mk@metnmat.com",
    phone: "+91 78726 86501",
    phone2: "+91 80018 38711",
    shipping: "Free shipping within India · worldwide shipping",
  },

  // Office addresses. Index 0 is the Howrah HQ — the GST invoice, JSON-LD
  // primary address, and the maps embed all key off it, so keep it first.
  // `lines` is for display; the structured fields drive PostalAddress.
  addresses: [
    {
      label: "Howrah (HQ)",
      lines: [
        "Gate No. 1, Jalan Industrial Complex, Lane No. 6,",
        "Bipranna Para, Via Begri, Domjur,",
        "Howrah, West Bengal – 711411",
      ],
      street: "Gate No. 1, Jalan Industrial Complex, Lane No. 6, Bipranna Para, Via Begri, Domjur",
      locality: "Howrah",
      region: "West Bengal",
      postalCode: "711411",
      country: "IN",
      geo: { lat: 22.605699658971638, lng: 88.2146446453073 },
      // Canonical Google Maps place (short link) + the official embed iframe URL.
      mapsUrl: "https://maps.app.goo.gl/iumcjPYJrXrgQK3K6",
      mapEmbedUrl:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1095.0482207212187!2d88.2146446453073!3d22.605699658971638!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f881d03c1acb25%3A0xcc2337489e731bd7!2sMETNMAT%20Research%20%26%20Innovations!5e0!3m2!1sen!2sin!4v1782470052320!5m2!1sen!2sin",
    },
    {
      label: "Mumbai",
      lines: [
        "6th Floor, Vishveshwar Nagar Rd,",
        "opp. Pravasi Industrial Estate, Yashodham,",
        "Goregaon East, Mumbai, Maharashtra – 400063",
      ],
      street: "6th Floor, Vishveshwar Nagar Rd, opp. Pravasi Industrial Estate, Yashodham, Goregaon East",
      locality: "Mumbai",
      region: "Maharashtra",
      postalCode: "400063",
      country: "IN",
    },
    {
      label: "Sambalpur",
      lines: ["Banka House, Marwaripada, Golbazar,", "Sambalpur, Odisha – 768001"],
      street: "Banka House, Marwaripada, Golbazar",
      locality: "Sambalpur",
      region: "Odisha",
      postalCode: "768001",
      country: "IN",
    },
  ],

  social: {
    linkedin: "https://in.linkedin.com/company/metnmat",
    youtube: "https://www.youtube.com/@metnmatresearchinnovations628",
    facebook: "https://www.facebook.com/metnmat",
    // Amazon.in storefront — the query params identify the merchant, keep them.
    amazon: "https://www.amazon.in/l/27943762031?ie=UTF8&marketplaceID=A21TJRUUN4KGV&me=AV4YEPJ3X45CF",
  },
} as const;

/** Primary navigation tabs (order matches the header). */
export const mainNav: { label: string; href: string }[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/shop" },
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Footer link groups (structure only — fill labels/links as content lands). */
export const footerNav: { title: string; links: { label: string; href: string }[] }[] = [
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
];

/**
 * Added after the footer groups, including ones from the CMS Navigation global: the
 * guides and the converter need a link from every page to be found and ranked.
 */
export const footerResources = {
  title: "Resources",
  links: [
    { label: "All products", href: "/shop/all" },
    { label: "Guides", href: "/guides" },
    { label: "Potential converter", href: "/tools/potential-converter" },
    { label: "Microstructure analysis", href: "/services/microstructure-analysis" },
    { label: "Metallurgical testing", href: "/services/metallurgical-testing" },
  ],
};

/**
 * The products buyers searched for most on metnmat.in, named as they searched. On
 * 2026-11-06 Google ranked these .com pages for their exact names but not for the broad
 * search, and the zinc sheet page, the biggest search of all, had no link from the home
 * page, the shop or the guides. With 8 links from other sites, a link from every page is
 * the strongest signal the site controls. Change this list only from Search Console data.
 */
export const footerProducts = {
  title: "Popular products",
  links: [
    { label: "Zinc sheet", href: "/shop/p/high-purity-zinc-sheet" },
    { label: "Ag/AgCl reference electrode", href: "/shop/p/silver-silver-chloride-ag-agcl-reference-electrode-2-50mm-glass-rod" },
    { label: "Platinum sheet electrode", href: "/shop/p/platinum-sheet-counter-electrode-30-30-0-1mm" },
    { label: "30 ton hydraulic press", href: "/shop/p/30-ton-hydraulic-press-four-pillar-hand-operated-semi-automatic-model" },
    { label: "Nickel foam", href: "/shop/p/nickel-foam-electrode-200-300-1-5-mm" },
    { label: "Swagelok cell", href: "/shop/p/swagelok-battery-test-fixture" },
    { label: "PTFE electrode holder", href: "/shop/p/ptfe-replaceable-electrode-holder-mpg-10" },
    { label: "Hot press machine", href: "/shop/p/hot-press-machine-for-pefc-membrane-electrode-assembly-hydraulic-hot-p" },
  ],
};
