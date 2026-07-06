import { site } from "@/frontend/lib/site";

/**
 * /llms.txt — a concise, plain-markdown brief for AI answer engines
 * (ChatGPT, Gemini, Perplexity, AI Overviews…) following the llms.txt
 * convention. Static facts only; content pages carry their own JSON-LD.
 */
export const dynamic = "force-static";

const office = site.addresses[0];
const addressLines = site.addresses
  .map((a) => `- ${a.label}: ${a.street}, ${a.locality}, ${a.region} ${a.postalCode}, India`)
  .join("\n");

const body = `# ${site.legalName} (${site.name})

> ${site.tagline}. METNMAT supplies electrochemistry lab equipment — electrodes
> (reference, counter, working), ion-exchange membranes (PEM, AEM, bipolar,
> cation), electrochemical cells, reactors, lab equipment and accessories —
> and delivers turnkey materials R&D from lab-scale prototype to industrial
> scale-up. Based in Howrah, West Bengal, India; ships across India and
> worldwide with GST invoicing and bulk B2B pricing.

Key facts:

- Founded: 2018
${addressLines}
- HQ map: ${office.mapsUrl}
- Email: ${site.contact.email}, ${site.contact.email2}
- Phone: ${site.contact.phone}, ${site.contact.phone2}
- Hours: Mon-Sat 10:00-18:30 IST

## Buy

- [Shop](${site.url}/shop): electrodes, membranes, cells, reactors, lab equipment
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

export function GET() {
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
