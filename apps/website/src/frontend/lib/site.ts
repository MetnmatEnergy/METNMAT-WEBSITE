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
  tagline: "India's first private Metallurgy & Materials R&D",
  url: "https://www.metnmat.com",
  description:
    "Metallurgy & materials R&D — lab-scale prototype to full industrial scale.",

  contact: {
    email: "contact@metnmat.com",
    phone: "+91 78726 86501",
    phone2: "+91 80018 38711",
    shipping: "Shipping across India & worldwide",
  },

  // Office address (METNMAT Research & Innovations).
  addresses: [
    {
      label: "West Bengal",
      lines: [
        "Jalan Industrial Complex, Gate No. 1, Lane No. 6,",
        "Bipranna Para, Via Begri, Domjur,",
        "Howrah, West Bengal – 711411",
      ],
    },
  ],

  social: {
    linkedin: "#",
    youtube: "#",
    facebook: "#",
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
