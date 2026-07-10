import { ArrowRight, Globe, BadgeCheck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import AnimatedTextCycle from "@/frontend/components/ui/animated-text-cycle";
import { ProductMosaic } from "@/frontend/components/home/product-mosaic";
import { HeroStats } from "@/frontend/components/home/hero-stats";
import { hero as phHero, stats as phStats, type Stat } from "@/frontend/lib/placeholder";
import type { Homepage } from "@/frontend/lib/cms";

// The product-mosaic badge cycles the "research grade" positioning. The first
// phrase is the static rename of the old "Lab-grade products" pill (so it reads
// correctly on first paint), then it rotates through the research-credibility
// taglines from the brief.
const RESEARCH_BADGE_PHRASES = [
  "High Quality Research Grade Products",
  "Made by researchers, for researchers",
  "Engineered for the lab",
  "Trusted in 15+ countries",
  "Research Grade",
  "Published, peer-reviewed results",
];

// Catchy kicker terms that cycle in the eyebrow pill. The first shown is the
// CMS-editable hero.eyebrow; the rest are these.
const KICKER_TERMS = [
  "Lab to industrial scale",
  "Research-grade engineering",
  "Metallurgy · Materials · Energy",
  "Engineered end-to-end",
];

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

      <Container className="relative grid items-start gap-8 pb-10 pt-6 sm:gap-10 sm:pt-8 lg:grid-cols-2 lg:gap-12 lg:pb-16 lg:pt-10">
        {/* Left: copy */}
        <div className="animate-fade-up">
          <Badge variant="dot">
            <AnimatedTextCycle
              words={[hero.eyebrow, ...KICKER_TERMS]}
              interval={2600}
              wrapperClassName="block whitespace-nowrap"
            />
          </Badge>

          {/* Brand tagline as the headline — two-tone (accent line in the brand
              gradient). Static, so nothing reserves extra vertical space. */}
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.02] tracking-tight sm:mt-5 sm:text-6xl lg:text-7xl">
            {hero.titleLead}
            <span className="block bg-brand-text bg-clip-text text-transparent">{hero.titleAccent}</span>
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

          <HeroStats stats={stats} />
        </div>

        {/* Right: auto-scrolling product mosaic (live featured products) */}
        <div className="relative hidden lg:block">
          <ProductMosaic />

          <div className="absolute -left-4 top-4 z-10 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg">
            <Globe className="h-4 w-4 text-brand" />
            Shipping worldwide
          </div>
          <div className="absolute -bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-card-foreground shadow-lg">
            <BadgeCheck className="h-4 w-4 shrink-0 text-brand" />
            <AnimatedTextCycle
              words={RESEARCH_BADGE_PHRASES}
              interval={2600}
              wrapperClassName="block whitespace-nowrap"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
