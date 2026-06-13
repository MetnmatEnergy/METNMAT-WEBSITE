import { ArrowRight, Globe, BadgeCheck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
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
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="bg-hero-glow pointer-events-none absolute inset-0" />

      <Container className="relative grid items-center gap-10 pb-10 pt-1 lg:grid-cols-2 lg:pb-14 lg:pt-2">
        {/* Left: copy */}
        <div className="animate-fade-up">
          <Badge variant="dot">{hero.eyebrow}</Badge>

          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            {hero.titleLead}{" "}
            <span className="bg-brand-text bg-clip-text text-transparent">
              {hero.titleAccent}
            </span>
          </h1>

          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            {hero.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href={hero.primaryCta.href} size="lg">
              {hero.primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href={hero.secondaryCta.href} variant="outline" size="lg">
              {hero.secondaryCta.label}
            </Button>
          </div>

          <dl className="mt-8 grid max-w-md grid-cols-3 gap-x-6 border-t border-border pt-6">
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
        <div className="relative hidden lg:block lg:-mt-10">
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
