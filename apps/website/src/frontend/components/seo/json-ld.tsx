import { site } from "@/frontend/lib/site";

// Primary office → a proper schema.org PostalAddress (locality/region/postcode
// are distinct fields so search engines parse the location correctly).
const primaryOffice = site.addresses[0];
const postalAddress = {
  "@type": "PostalAddress",
  streetAddress: primaryOffice.street,
  addressLocality: primaryOffice.locality,
  addressRegion: primaryOffice.region,
  postalCode: primaryOffice.postalCode,
  addressCountry: primaryOffice.country,
};

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
  "@type": "Organization",
  name: site.legalName,
  alternateName: site.name,
  url: site.url,
  logo: `${site.url}/icon-512.png`,
  image: `${site.url}/opengraph-image`,
  description: site.description,
  email: site.contact.email,
  telephone: site.contact.phone,
  foundingDate: "2018",
  areaServed: ["IN", "Worldwide"],
  knowsAbout: [
    "Metallurgy",
    "Materials science",
    "Electrochemistry",
    "Heat treatment",
    "Copper alloys",
    "R&D",
  ],
  address: postalAddress,
  location: {
    "@type": "Place",
    name: site.legalName,
    address: postalAddress,
    geo: {
      "@type": "GeoCoordinates",
      latitude: primaryOffice.geo.lat,
      longitude: primaryOffice.geo.lng,
    },
    hasMap: primaryOffice.mapsUrl,
  },
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
  sameAs: [site.social.linkedin, site.social.youtube, site.social.facebook].filter(
    (u) => u && u !== "#"
  ),
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
