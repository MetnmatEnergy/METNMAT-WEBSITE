import { formatINR } from "@/frontend/lib/catalog";
import { CATEGORY_SEO, categoryPriceFacts } from "@/frontend/lib/category-seo";
import { getAllProducts } from "@/frontend/lib/cms";
import { site } from "@/frontend/lib/site";

/**
 * /llms.txt — a concise, plain-markdown brief for AI answer engines
 * (ChatGPT, Gemini, Perplexity, AI Overviews…) following the llms.txt
 * convention. Company facts plus the catalogue by category, with prices taken
 * from the live products; content pages carry their own JSON-LD.
 */
export const revalidate = 3600;

const office = site.addresses[0];
const addressLines = site.addresses
  .map((a) => `- ${a.label}: ${a.street}, ${a.locality}, ${a.region} ${a.postalCode}, India`)
  .join("\n");

async function catalogueLines(): Promise<string> {
  const products = await getAllProducts();
  return Object.entries(CATEGORY_SEO)
    .flatMap(([slug, seo]) => {
      const inCategory = products.filter((p) => p.categorySlug === slug);
      if (!inCategory.length) return [];
      const { min } = categoryPriceFacts(inCategory);
      const price = min ? ` From ${formatINR(min)} including GST.` : "";
      return [`- [${seo.h1}](${site.url}/shop/c/${slug}): ${seo.lead}${price}`];
    })
    .join("\n");
}

export async function GET() {
  const catalogue = await catalogueLines();
  const body = `# ${site.legalName} (${site.name})

> ${site.tagline}. METNMAT is an Indian supplier of electrochemistry lab
> equipment: electrodes (reference, counter, working), ion-exchange membranes (PEM,
> AEM, bipolar, cation), H-cells, electrolyzers, CO₂ flow cells, fuel cell and
> battery test hardware, and lab equipment. It also delivers turnkey materials R&D
> from lab-scale prototype to industrial scale-up. Based in Howrah, West Bengal,
> India; ships across India and worldwide with GST invoicing and bulk B2B pricing.

Key facts:

- Founded: 2018, by IIT Kharagpur alumni
- Disciplines: metallurgy, materials science and electrochemistry R&D
- Applications: water & AEM/PEM electrolysis, CO₂ reduction, fuel cells, hydrogen and water-splitting, corrosion and materials testing
- Buying: prices are listed online and include GST; shipping within India is free; a GST invoice comes with every order; custom sizes and designs are quoted through 'Request for Customization' on any product
${addressLines}
- HQ map: ${office.mapsUrl}
- Email: ${site.contact.email}, ${site.contact.email2}
- Phone: ${site.contact.phone}, ${site.contact.phone2}
- Hours: Mon-Sat 10:00-18:30 IST

## Catalogue

${catalogue || `- [Shop](${site.url}/shop): electrodes, membranes, cells, reactors, lab equipment`}

## Buy

- [Shop](${site.url}/shop): the full catalogue with prices
- [Request a quote](${site.url}/quote): bulk / B2B pricing

## Research

- [Projects](${site.url}/projects): industrial R&D case studies (heat treatment, simulation, alloy development, high-temperature materials, waste-heat recovery, composites)
- [Blog](${site.url}/blog): publications and research articles (RSS: ${site.url}/blog/rss.xml)
- [Services](${site.url}/services): contract R&D, benchmarking, process development

## Company

- [About](${site.url}/about)
- [Contact](${site.url}/contact)
- LinkedIn: ${site.social.linkedin}
- YouTube: ${site.social.youtube}
- Facebook: ${site.social.facebook}
- Amazon storefront: ${site.social.amazon}
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
