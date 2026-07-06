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

/** Injects JSON-LD structured data (Organization by default). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export const organizationJsonLd = {
  "@context": "https://schema.org",
  // Dual-typed: Organization for brand/knowledge-panel signals, LocalBusiness
  // so the geo/address/opening-hours drive local search (GEO).
  "@type": ["Organization", "LocalBusiness"],
  name: site.legalName,
  alternateName: site.name,
  url: site.url,
  logo: `${site.url}/icon-512.png`,
  image: `${site.url}/opengraph-image`,
  description: site.description,
  email: [site.contact.email, site.contact.email2],
  telephone: site.contact.phone,
  foundingDate: "2018",
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
  knowsAbout: [
    "Metallurgy",
    "Materials science",
    "Electrochemistry",
    "Heat treatment",
    "Copper alloys",
    "R&D",
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
