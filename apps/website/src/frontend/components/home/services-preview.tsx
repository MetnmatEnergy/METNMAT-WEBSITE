import Link from "next/link";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { InfoCard } from "@/frontend/components/ui/info-card";
import { SERVICE_IMAGES } from "@/frontend/lib/service-images";
import { services as phServices, type Service } from "@/frontend/lib/placeholder";

export function ServicesPreview({ services = phServices }: { services?: Service[] } = {}) {
  return (
    <section className="section">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="What we do"
            title="End-to-end materials R&D"
            description="From lab-scale prototypes to industrial-scale solutions — development, applied research, benchmarking, heat treatment and simulation."
          />
          <Button href="/services" variant="outline" size="sm">
            All services
          </Button>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 6).map((service) => (
            <Link
              key={service.slug}
              href={`/services#${service.slug}`}
              className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
              // No aria-label. It overrode the accessible name with just the
              // title, while the visible text is the title AND the summary — so
              // the name no longer contained the visible label and failed WCAG
              // 2.5.3 (Label in Name), which breaks voice control: saying the
              // words on screen no longer matched the target. The card's own
              // content names the link accurately.
            >
              <InfoCard
                image={SERVICE_IMAGES[service.slug]}
                title={service.title}
                description={service.summary}
              />
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
