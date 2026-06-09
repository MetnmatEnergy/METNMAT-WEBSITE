import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { GetQuoteButton } from "@/frontend/components/commerce/request-quote-button";

export function CtaBand() {
  return (
    <section className="section">
      <Container>
        <div className="bg-hero-glow relative overflow-hidden rounded-3xl border border-border bg-surface px-8 py-14 text-center sm:px-16">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative mx-auto max-w-2xl">
            {/* TODO(content): final CTA copy. */}
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Have a materials challenge? Let&apos;s solve it.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Tell us about your process and goals — we&apos;ll scope the R&D path
              from prototype to production.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <GetQuoteButton label="Get a Quote" size="lg" withArrow />
              <Button href="/contact" variant="outline" size="lg">
                Contact us
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
