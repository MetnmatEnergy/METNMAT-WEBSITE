import Image from "next/image";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { GetQuoteButton } from "@/frontend/components/commerce/request-quote-button";

export function CtaBand() {
  return (
    <section className="section">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-8 py-14 text-center sm:px-16">
          {/* Brand banner (light mode). Decorative; a legibility scrim keeps the
              centred copy readable over the lighter and pink-accented areas. */}
          <div className="pointer-events-none absolute inset-0 dark:hidden">
            <Image
              src="/cta-banner.webp"
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[radial-gradient(65%_120%_at_50%_45%,hsl(var(--surface)/0.55),transparent_75%)]" />
          </div>
          {/* Dark mode keeps the themed glow + grid (the light banner would
              swallow dark-mode's near-white text). */}
          <div className="bg-hero-glow pointer-events-none absolute inset-0 hidden opacity-60 dark:block" />
          <div className="bg-grid pointer-events-none absolute inset-0 hidden opacity-60 dark:block" />

          <div className="relative mx-auto max-w-2xl">
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
