import { site } from "@/frontend/lib/site";

// Offices → proper schema.org PostalAddress (locality/region/postcode are
// distinct fields so search engines parse the location correctly). Index 0
// is the Howrah HQ and remains the LocalBusiness primary address.
const primaryOffice = site.addresses[0];
const toPostalAddress = (a: (typeof site.addresses)[number]) => ({
  "@type": "PostalAddress",
  streetAddress: a.street,
  addressLocality: a.locality,
  addressRegion: a.region,
  postalCode: a.postalCode,
  addressCountry: a.country,
});
const postalAddress = toPostalAddress(primaryOffice);

/**
 * Richer Organization description for GEO — the single most load-bearing
 * machine-readable sentence an AI/knowledge-panel reads to summarise the entity.
 * site.description is a terse one-liner that drops the electrochemistry-equipment
 * business, applications and geography; this expands it using ONLY facts already
 * published on the site (CMS company description, About, catalog, offices). No
 * new claims. site.description stays as-is for other callers.
 */
const orgDescription =
  "METNMAT Innovations is a materials, metallurgy and electrochemistry R&D company. " +
  "It supplies research-grade electrochemistry lab equipment — electrodes, reference electrodes, " +
  "ion-exchange membranes, and electrochemical cells and reactors — and delivers turnkey materials " +
  "and metallurgy R&D from lab-scale prototype through pilot to full industrial scale. " +
  `Headquartered in ${primaryOffice.locality}, ${primaryOffice.region}, India, with offices in ` +
  `${site.addresses.slice(1).map((a) => a.locality).join(" and ")}; ships across India and worldwide. ` +
  "Founded by IIT Kharagpur alumni.";

/**
 * Escape a JSON string for safe embedding in a <script> block. JSON.stringify
 * does NOT escape `<`, `>`, `&` or the JS line separators, so CMS-derived values
 * (product names, blog titles) containing `</script>` could break out of the
 * tag — a stored-XSS vector. Escaping to \uXXXX keeps the JSON valid.
 */
function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Injects JSON-LD structured data (Organization by default). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  // Dual-typed: Organization for brand/knowledge-panel signals, LocalBusiness
  // so the geo/address/opening-hours drive local search (GEO).
  "@type": ["Organization", "LocalBusiness"],
  // Stable @id so the emissions on / and /about dedupe to ONE entity.
  "@id": `${site.url}/#organization`,
  // Canonical legal name everywhere (product seller, blog/project publisher use
  // site.legalName too — keep them in sync). Real name variants only, including
  // the heavily-used public display name so answer engines reconcile it.
  name: site.legalName,
  alternateName: [site.name, "METNMAT Innovations", "METNMAT Research & Innovations", "Metnmat"],
  url: site.url,
  logo: `${site.url}/icon-512.png`,
  image: `${site.url}/opengraph-image`,
  description: orgDescription,
  slogan: site.tagline,
  email: [site.contact.email, site.contact.email2],
  telephone: site.contact.phone,
  foundingDate: "2018",
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: primaryOffice.locality,
      addressRegion: primaryOffice.region,
      addressCountry: primaryOffice.country,
    },
  },
  areaServed: ["IN", "Worldwide"],
  geo: {
    "@type": "GeoCoordinates",
    latitude: primaryOffice.geo.lat,
    longitude: primaryOffice.geo.lng,
  },
  hasMap: primaryOffice.mapsUrl,
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      opens: "10:00",
      closes: "18:30",
    },
  ],
  // Declared competencies for GEO — every item is a discipline or product line
  // the site itself documents (catalog, About, Services, FAQ, blog). Factual
  // capability list, not keyword stuffing.
  knowsAbout: [
    "Metallurgy",
    "Materials science",
    "Electrochemistry",
    "Reference electrodes",
    "Ion-exchange membranes",
    "Electrochemical cells and reactors",
    "Fuel cells",
    "Water electrolysis",
    "CO2 reduction",
    "Catalyst development",
    "Heat treatment",
    "Alloy and composite development",
    "Materials characterization",
    "Process development from lab to industrial scale",
    "Research and development",
  ],
  address: postalAddress,
  // All offices as Places; only the HQ carries geo + the canonical map link.
  location: site.addresses.map((a) => ({
    "@type": "Place",
    name: `${site.legalName} — ${a.label}`,
    address: toPostalAddress(a),
    ...("geo" in a
      ? {
          geo: { "@type": "GeoCoordinates", latitude: a.geo.lat, longitude: a.geo.lng },
          hasMap: a.mapsUrl,
        }
      : {}),
  })),
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      telephone: site.contact.phone,
      email: site.contact.email,
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: site.contact.phone2,
      email: site.contact.email,
      areaServed: "IN",
    },
  ],
  sameAs: (
    [site.social.linkedin, site.social.youtube, site.social.facebook, site.social.amazon] as string[]
  ).filter((u) => u && u !== "#"),
};

/** WebSite schema with a SearchAction — helps search engines + AI answer engines. */
export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.legalName,
  url: site.url,
  potentialAction: {
    "@type": "SearchAction",
    target: `${site.url}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

/** FAQPage schema — strong signal for AI answer engines (GEO) + rich results. */
export function faqJsonLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Build a BreadcrumbList for a page (rich results + AI grounding). */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${site.url}${it.path}`,
    })),
  };
}
