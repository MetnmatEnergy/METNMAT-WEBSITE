/**
 * The single source of truth for every schema.org entity this site emits.
 *
 * Pure data builders only — no JSX — so they can be unit-tested directly and so
 * the shapes cannot drift between pages. Pages import these and hand the result
 * to <JsonLd>. Emitting hand-written schema inline in a page is how the seller
 * and author nodes previously ended up describing two different companies.
 */
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
export function safeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
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

/** ItemList of links (a product grid or a category list) — helps search + AI
 *  understand a listing page's contents. Paths are absolute-ised against site.url. */
export function itemListJsonLd(name: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${site.url}${it.path}`,
      name: it.name,
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

/**
 * A reference to the company entity, for use as `seller`, `author`, `provider`
 * etc. Nodes that use this MUST also emit `organizationJsonLd` on the same page
 * so the @id resolves — a reference with nothing defining it leaves the entity
 * as a bare name.
 *
 * This exists because the same node was previously hand-written in several
 * places and drifted: product Offers named a seller that no node defined, and
 * articles with no listed author emitted an anonymous Organization beside a
 * publisher for the same company. One constant, one shape.
 */
export const organizationRef = {
  "@type": "Organization",
  "@id": `${site.url}/#organization`,
  name: site.legalName,
} as const;

/** The publisher node for articles: the company reference plus the logo Google wants. */
export const publisherJsonLd = {
  ...organizationRef,
  url: site.url,
  logo: { "@type": "ImageObject", url: `${site.url}/icon-512.png` },
} as const;

type ProductSchemaInput = {
  slug: string;
  name: string;
  sku?: string;
  brand?: string;
  shortDesc?: string;
  imageUrl?: string;
  price?: number;
  inStock?: boolean;
  specs?: { label?: string; value?: string }[];
};

/**
 * Product + Offer for a catalogue detail page.
 *
 * `offer` is omitted entirely for quote-only/discontinued items: the page shows
 * "Price on request", so advertising a concrete price and InStock in structured
 * data would misrepresent the listing in search results. Optional fields are
 * omitted rather than emitted empty — the CMS mapper defaults brand/sku/shortDesc
 * to "", and an empty Brand or description node is invalid markup.
 */
export function productJsonLd({
  product,
  categoryName,
  priceInclGst,
  offerable,
}: {
  product: ProductSchemaInput;
  categoryName?: string;
  /** GST-inclusive price, already computed by the caller. */
  priceInclGst?: number;
  /** False for quote-only / discontinued items — suppresses the whole Offer. */
  offerable: boolean;
}) {
  const specs = (product.specs ?? []).filter((s) => s.label && s.value);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.sku ? { sku: product.sku, mpn: product.sku } : {}),
    ...(categoryName ? { category: categoryName } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.shortDesc ? { description: product.shortDesc } : {}),
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    // Surface the specs already rendered on the page as machine-readable
    // properties (rich results + AI grounding).
    ...(specs.length
      ? {
          additionalProperty: specs.map((s) => ({
            "@type": "PropertyValue",
            name: s.label,
            value: s.value,
          })),
        }
      : {}),
    ...(offerable && priceInclGst
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: priceInclGst,
            // Rolling ~1-year horizon so the price is never read as "expired".
            // A revalidate-by date, NOT a promotion end date.
            priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            url: `${site.url}/shop/p/${product.slug}`,
            seller: organizationRef,
            // Backed 1:1 by the published /replacement-policy page: 7 days from
            // delivery, replacement-only (no monetary refund → ExchangeRefund).
            // returnMethod/returnFees are omitted deliberately — the policy does
            // not state them, and inventing either would be a fabricated claim.
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "IN",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: 7,
              refundType: "https://schema.org/ExchangeRefund",
              merchantReturnLink: `${site.url}/replacement-policy`,
            },
          },
        }
      : {}),
  };
}

type ArticleSchemaInput = {
  slug: string;
  title: string;
  metaDescription?: string | null;
  excerpt?: string | null;
  abstract?: string | null;
  categoryName?: string | null;
  keywords?: string | null;
  date?: string | null;
  updatedAt?: string | null;
  ogImageUrl?: string | null;
  authors: { name: string; organisation?: string | null; orcidUrl?: string | null }[];
};

/**
 * BlogPosting, or TechArticle for the research-style categories.
 *
 * With no named authors the company itself is the author — carried as the
 * canonical @id so it resolves to the same entity as the publisher rather than
 * reading as a second, anonymous organisation.
 */
export function articleJsonLd(article: ArticleSchemaInput, isTech: boolean) {
  const url = `${site.url}/blog/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": isTech ? "TechArticle" : "BlogPosting",
    headline: article.title,
    description: article.metaDescription ?? article.excerpt,
    ...(article.abstract ? { abstract: article.abstract } : {}),
    articleSection: article.categoryName,
    ...(article.keywords ? { keywords: article.keywords } : {}),
    ...(article.date ? { datePublished: article.date } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    mainEntityOfPage: url,
    url,
    ...(article.ogImageUrl ? { image: article.ogImageUrl } : {}),
    author: article.authors.length
      ? article.authors.map((a) => ({
          "@type": "Person",
          name: a.name,
          ...(a.organisation ? { affiliation: { "@type": "Organization", name: a.organisation } } : {}),
          ...(a.orcidUrl ? { sameAs: a.orcidUrl } : {}),
        }))
      : organizationRef,
    publisher: publisherJsonLd,
  };
}

type FaqProductInput = {
  name: string;
  inStock?: boolean;
  leadTime?: string;
  productType?: string;
  moq?: number;
  unit?: string;
  priceTiers?: { minQty?: number }[];
  sizes?: string[];
  countryOfOrigin?: string;
  hsnSac?: string;
  datasheets?: unknown[];
};

/**
 * Buyer questions for a product page, answered ONLY from fields that are
 * actually set on that product or from a published policy page.
 *
 * Every entry is conditional on its source data existing. Nothing here is
 * written to fill space: an FAQ that answers "what is the lead time?" for a
 * product with no lead time recorded would be invented content, and it would be
 * backing FAQPage structured data with a claim the business never made.
 */
export function productFaqs(p: FaqProductInput): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  const quoteOnly = p.productType === "quote-only";
  const discontinued = p.productType === "discontinued";

  if (discontinued) {
    faqs.push({
      q: `Is ${p.name} still available?`,
      a: `${p.name} is discontinued. Contact us and we will suggest a current equivalent from the catalogue.`,
    });
  } else if (quoteOnly) {
    faqs.push({
      q: `How do I get a price for ${p.name}?`,
      a: `${p.name} is supplied on a quotation basis. Send a request through the product page or the quote form and we will price it against your specification and quantity.`,
    });
  } else if (p.inStock !== undefined) {
    faqs.push({
      q: `Is ${p.name} in stock?`,
      a: p.inStock
        ? `Yes — ${p.name} is in stock.${p.leadTime ? ` ${p.leadTime}.` : ""}`
        : `${p.name} is currently out of stock.${p.leadTime ? ` ${p.leadTime}.` : ""} Contact us for the current lead time.`,
    });
  }

  if (p.moq && p.moq > 1) {
    faqs.push({
      q: `What is the minimum order quantity?`,
      a: `The minimum order is ${p.moq} ${p.unit || "unit"}${p.moq > 1 ? "s" : ""}.`,
    });
  }

  if (p.priceTiers?.length) {
    const from = p.priceTiers.map((t) => t.minQty).filter((q): q is number => typeof q === "number").sort((a, b) => a - b)[0];
    faqs.push({
      q: `Is bulk pricing available?`,
      a: `Yes. Tiered pricing applies${from ? ` from ${from} ${p.unit || "unit"}s upward` : ""} — the price breaks are listed on this page.`,
    });
  }

  if (p.sizes?.length) {
    faqs.push({
      q: `What sizes are available?`,
      a: `${p.sizes.join(", ")}. Select the size you need before adding to the cart.`,
    });
  }

  if (p.countryOfOrigin) {
    faqs.push({ q: `Where is it made?`, a: `Country of origin: ${p.countryOfOrigin}.` });
  }

  if (p.datasheets?.length) {
    faqs.push({
      q: `Is a datasheet available?`,
      a: `Yes — the datasheet is linked on this page under the product documents.`,
    });
  }

  // Policies published on the site, identical for every product.
  faqs.push({
    q: `Do you provide a GST invoice?`,
    a: `Yes. Every order ships with a GST invoice${p.hsnSac ? ` (HSN/SAC ${p.hsnSac})` : ""}.`,
  });
  faqs.push({
    q: `Can I return or replace it?`,
    a: `We do not offer refunds. Eligible orders are covered by a 7-day replacement policy from the date of delivery, for items that arrive defective, damaged or incorrect. See the Replacement Policy page for the full conditions.`,
  });
  faqs.push({
    q: `Do you ship outside India?`,
    a: `Yes — we ship across India and worldwide.`,
  });

  return faqs;
}
