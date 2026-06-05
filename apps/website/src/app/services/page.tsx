import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ServiceCard } from "@/frontend/components/cards/service-card";
import { CtaBand } from "@/frontend/components/home/cta";
import { services } from "@/frontend/lib/placeholder";

export const metadata: Metadata = {
  title: "Services",
  description: "Materials & metallurgy R&D services from METNMAT.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="What we do"
        description="Intro paragraph describing the full range of services. Replace with approved copy."
      />

      <section className="section">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
