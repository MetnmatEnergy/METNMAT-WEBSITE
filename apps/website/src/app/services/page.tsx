import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ServiceCard } from "@/frontend/components/cards/service-card";
import { CtaBand } from "@/frontend/components/home/cta";
import { getServices } from "@/frontend/lib/cms";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Services",
  description:
    "Materials & metallurgy R&D services from METNMAT — product & process development, applied research, benchmarking, microstructure & heat treatment, and modeling & simulation.",
  path: "/services",
});

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="What we do"
        description="Customized turnkey R&D for metallurgy & materials — from lab-scale prototype to full industrial scale. Development, applied research, benchmarking, heat treatment and simulation under one roof."
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
