import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { Card } from "@/frontend/components/ui/card";
import { QuoteForm } from "@/frontend/components/commerce/quote-form";
import { pageMetadata } from "@/frontend/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Get a Quote",
  description: "Request a quote for R&D services or products from METNMAT — materials, metallurgy and electrochemistry, with GST invoicing.",
  path: "/quote",
});

export default function QuotePage() {
  return (
    <>
      <PageHero
        eyebrow="Get a Quote"
        title="Request a quote"
        description="Tell us what you need — services, products, or both — and we'll scope it for you."
      />

      <section className="section">
        <Container className="max-w-3xl">
          <Card className="bg-surface/60">
            <QuoteForm />
          </Card>
        </Container>
      </section>
    </>
  );
}
