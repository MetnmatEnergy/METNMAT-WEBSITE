import { ArrowRight, Globe, BadgeCheck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import AnimatedTextCycle from "@/frontend/components/ui/animated-text-cycle";
import { ProductMosaic } from "@/frontend/components/home/product-mosaic";
import { hero as phHero, stats as phStats, type Stat } from "@/frontend/lib/placeholder";
import type { Homepage } from "@/frontend/lib/cms";

export function Hero({
  hero = phHero,
  stats = phStats,
}: {
  hero?: Homepage["hero"];
  stats?: Stat[];
} = {}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Background texture — softer than the inner-page heroes: the homepage
          headline is the hero, the grid must support it, not compete with it. */}
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="bg-hero-glow pointer-events-none absolute inset-0" />

      <Container className="relative grid items-start gap-8 pb-10 pt-8 sm:gap-10 sm:pt-10 lg:grid-cols-2 lg:gap-12 lg:pb-16 lg:pt-12">
        {/* Left: copy */}
        <div className="animate-fade-up">
          <Badge variant="dot">{hero.eyebrow}</Badge>

          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.07] tracking-tight sm:mt-6 sm:text-5xl lg:text-6xl xl:text-7xl">
            {hero.titleLead}
            {/* Dynamic accent — deliberately smaller than the static headline so
                it reads as a tagline and never overflows/clips on long phrases. */}
            <span className="mt-2 block leading-[1.05]">
              <AnimatedTextCycle
                words={[
                  hero.titleAccent,
                  "cleaner",
                  "stronger ",
                  "Cheaper",
                  "Impactful",
                ]}
                interval={2800}
                className="bg-brand-text bg-clip-text text-transparent"
              />
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground/70 sm:mt-6 sm:text-lg">
            {hero.subtitle}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
            <Button href={hero.primaryCta.href} size="lg" className="w-full sm:w-auto">
              {hero.primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              href={hero.secondaryCta.href}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              {hero.secondaryCta.label}
            </Button>
          </div>

          <dl className="mt-8 grid max-w-lg grid-cols-3 gap-x-4 border-t border-border pt-6 sm:gap-x-6 lg:mt-10">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <dt className="font-display text-2xl font-bold leading-none tracking-tight tabular-nums sm:text-3xl lg:text-4xl">
                  {s.value}
                </dt>
                <dd className="mt-2 text-xs leading-snug text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Right: auto-scrolling product mosaic (live featured products) */}
        <div className="relative hidden lg:block">
          <ProductMosaic />

          <div className="absolute -left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg">
            <Globe className="h-4 w-4 text-brand" />
            Shipping worldwide
          </div>
          <div className="absolute -bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg">
            <BadgeCheck className="h-4 w-4 text-brand" />
            Lab-grade products
          </div>
        </div>
      </Container>
    </section>
  );
}
