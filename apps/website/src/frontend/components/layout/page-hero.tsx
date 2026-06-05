import { Container } from "@/frontend/components/ui/container";
import { Badge } from "@/frontend/components/ui/badge";

/** Compact hero used at the top of inner pages. */
export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="bg-hero-glow pointer-events-none absolute inset-0" />
      <Container className="relative py-16 lg:py-20">
        {eyebrow && <Badge variant="brand">{eyebrow}</Badge>}
        <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {description}
          </p>
        )}
      </Container>
    </section>
  );
}
