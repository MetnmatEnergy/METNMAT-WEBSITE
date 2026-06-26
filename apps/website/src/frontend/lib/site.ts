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

  // Office address (METNMAT Research & Innovations, Howrah). Single source of
  // truth — used by the contact page, footer, GST invoice and Organization
  // JSON-LD. `lines` is for display; the structured fields drive PostalAddress.
  addresses: [
    {
      label: "West Bengal",
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
