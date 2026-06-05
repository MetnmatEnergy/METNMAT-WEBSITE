import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { ServiceCard } from "@/frontend/components/cards/service-card";
import { services } from "@/frontend/lib/placeholder";

export function ServicesPreview() {
  return (
    <section className="section">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="What we do"
            title="End-to-end materials R&D"
            description="A short intro line describing the breadth of services. Replace with approved copy."
          />
          <Button href="/services" variant="outline" size="sm">
            All services
          </Button>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 6).map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </Container>
    </section>
  );
}
