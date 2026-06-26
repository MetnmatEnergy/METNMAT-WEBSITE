import type { Metadata } from "next";
import { FlaskConical, Gauge, Factory, type LucideIcon } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ServiceCard } from "@/frontend/components/cards/service-card";
import { ExpandingCards, type ExpandCard } from "@/frontend/components/ui/expand-cards";
import { CtaBand } from "@/frontend/components/home/cta";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { getServices } from "@/frontend/lib/cms";
import { site } from "@/frontend/lib/site";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Services",
  description:
    "Customized, turnkey materials & metallurgy R&D from METNMAT — product & process development, applied research & consultancy, process & quality improvement, product benchmarking, materials testing & characterization, and materials processing facilities.",
  path: "/services",
});

// Themed Unsplash photography per service. If a photo is blocked or 404s, the
// ExpandingCards component falls back to a brand gradient (never a broken card).
// Keyed by every slug that can appear — placeholder fallback AND the live CMS —
// so the showcase shows photos regardless of which data source is in use.
const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=70`;

const SERVICE_IMAGES: Record<string, string> = {
  "product-process-development": unsplash("1581092918056-0c4c3acd3789"),
  "applied-research-consultancy": unsplash("1581091226825-a6a2a5aee158"),
  "process-quality-improvement": unsplash("1581092160562-40aa08e78837"),
  "product-benchmarking": unsplash("1460925895917-afdab827c52f"),
  "microstructure-heat-treatment": unsplash("1635070041078-e363dbe005cb"),
  "modeling-simulations": unsplash("1518770660439-4636190af475"),
  "materials-testing-characterization": unsplash("1576086213369-97a306d36557"),
  "materials-processing-facilities": unsplash("1504917595217-d4dc5ebe6122"),
};

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

  // Showcase = the headline services (capped so the expanding row stays usable).
  const showcase: ExpandCard[] = services.slice(0, 8).map((s) => ({
    title: s.title,
    summary: s.summary,
    href: `/services#${s.slug}`,
    icon: s.icon,
    image: SERVICE_IMAGES[s.slug],
  }));

  const servicesJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "METNMAT services",
    itemListElement: services.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.title,
      description: s.summary,
      url: `${site.url}/services#${s.slug}`,
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
      <JsonLd data={servicesJsonLd} />
      <PageHero
        eyebrow="Services"
        title="What we do"
        description="Customized, turnkey R&D for metallurgy & materials. Every client is unique, so we tailor each solution to your requirement — from lab-scale prototype to full industrial scale."
        bordered={false}
      />

      {/* Expanding showcase — hover or focus a card to explore it (taps & stacks on mobile). */}
      {showcase.length > 0 && (
        <section className="section pt-0">
          <Container>
            <h2 className="sr-only">Our services</h2>
            <ExpandingCards items={showcase} />
          </Container>
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

      {/* Detailed grid — anchor targets (#slug) for deep links + SEO. */}
      <section className="section">
        <Container>
          <SectionHeading eyebrow="In detail" title="Every service, explained" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-10 lg:grid-cols-3">
            {services.map((service) => (
              <div key={service.slug} id={service.slug} className="scroll-mt-28">
                <ServiceCard service={service} />
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand />
    </>
  );
}
