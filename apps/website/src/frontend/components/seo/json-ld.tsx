import { site } from "@/frontend/lib/site";

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
  url: site.url,
  description: site.description,
  email: site.contact.email,
  telephone: site.contact.phone,
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
    target: `${site.url}/shop?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

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
