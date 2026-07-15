import type { Metadata } from "next";
import { FlaskConical, Gauge, Factory, type LucideIcon } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ServiceCardStack, type ServiceStackItem } from "@/frontend/components/ui/service-card-stack";
import CardFanCarousel, { type CardItem } from "@/frontend/components/ui/card-fan-carousel";
import { CtaBand } from "@/frontend/components/home/cta";
import { JsonLd, organizationJsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { getServices } from "@/frontend/lib/cms";
import { SERVICE_IMAGES } from "@/frontend/lib/service-images";
import { SERVICE_DETAILS } from "@/frontend/lib/service-details";
import { site } from "@/frontend/lib/site";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Services",
  description:
    "Customized, turnkey materials & metallurgy R&D from METNMAT — product & process development, applied research & consultancy, process & quality improvement, product benchmarking, materials testing & characterization, and materials processing facilities.",
  path: "/services",
});

// METNMAT's stated delivery arc — lab-scale prototype through to industrial scale.
const APPROACH: { icon: LucideIcon; step: string; title: string; body: string }[] = [
  {
    icon: FlaskConical,
    step: "01",
    title: "Develop",
    body: "We build and validate a lab-scale prototype tailored to your specific requirement.",
  },
  {
    icon: Gauge,
    step: "02",
    title: "Refine",
    body: "We optimize cost, quality and process through testing, benchmarking and simulation.",
  },
  {
    icon: Factory,
    step: "03",
    title: "Scale",
    body: "We take the validated process through to reliable industrial-scale production.",
  },
];

export default async function ServicesPage() {
  const services = await getServices();

  // Showcase = the headline services as a fanned card deck (capped at 8).
  const fanCards: CardItem[] = services
    .slice(0, 8)
    .map((s) => ({
      imgUrl: SERVICE_IMAGES[s.slug],
      alt: s.title,
      title: s.title,
      linkUrl: `/services#${s.slug}`,
    }))
    .filter((c) => Boolean(c.imgUrl));

  const detailCards: ServiceStackItem[] = services.map((s) => {
    const detail = SERVICE_DETAILS[s.slug];
    return {
      slug: s.slug,
      title: s.title,
      summary: s.summary,
      icon: s.icon,
      href: "/quote",
      image: SERVICE_IMAGES[s.slug],
      detail: detail?.detail,
      points: detail?.points,
      outcome: detail?.outcome,
    };
  });

  // Type each item as a schema.org Service PROVIDED BY the organization (not a
  // bare ListItem) so answer engines can ground "what services does METNMAT
  // offer / does METNMAT do heat treatment" against the #organization entity.
  // Uses only real CMS title/summary + the on-page anchor — no price/rating/
  // duration (services are quote-based), so nothing is invented.
  const servicesJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${site.legalName} services`,
    itemListElement: services.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Service",
        name: s.title,
        ...(s.summary ? { description: s.summary } : {}),
        serviceType: s.title,
        url: `${site.url}/services#${s.slug}`,
        provider: { "@id": `${site.url}/#organization` },
        areaServed: ["IN", "Worldwide"],
      },
    })),
  };

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
        ])}
      />
      {/* Emit the org node here so each Service's provider {@id:#organization}
          resolves; deduped by @id (same as /, /about, /contact). */}
      <JsonLd data={organizationJsonLd} />
      <JsonLd data={servicesJsonLd} />
      <PageHero
        eyebrow="Services"
        title="What we do"
        description="Customized, turnkey R&D for metallurgy & materials. Every client is unique, so we tailor each solution to your requirement — from lab-scale prototype to full industrial scale."
        bordered={false}
      />

      {/* Fanned service deck — hover to spread the cards; tap a card to jump to
          that service's detail. Arrows/dots paginate the 8 disciplines. */}
      {fanCards.length > 0 && (
        <section className="section pt-0" aria-label="Our services">
          <h2 className="sr-only">Our services</h2>
          <CardFanCarousel cards={fanCards} />
        </section>
      )}

      {/* How we work — METNMAT's lab-to-industrial delivery arc. */}
      <section className="section border-t border-border bg-surface/40">
        <Container>
          <SectionHeading
            eyebrow="How we work"
            title="From lab-scale prototype to industrial scale"
          />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
            {APPROACH.map((s) => (
              <div
                key={s.step}
                className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -top-3 font-display text-7xl font-bold text-foreground/[0.04]"
                >
                  {s.step}
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Service card deck — cards carry id={slug}; showcase deep links spin
          the matching card to the front. */}
      <section className="section scroll-mt-28" id="services-book">
        <Container>
          <SectionHeading
            eyebrow="In detail"
            title="Every service, explained"
            description="Drag through the deck — eight disciplines, every engagement runs lab bench to plant floor."
          />
          <div className="mt-10">
            <ServiceCardStack items={detailCards} />
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
