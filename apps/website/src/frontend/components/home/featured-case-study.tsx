import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { MediaPlaceholder } from "@/frontend/components/ui/card";

export function FeaturedCaseStudy() {
  return (
    <section className="section border-y border-border bg-surface/40">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <MediaPlaceholder className="aspect-[4/3]" label="Featured case study" />
        <div>
          <Badge variant="brand">Featured case study</Badge>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Oxygen-free high-strength electrical copper alloy
          </h2>
          <p className="mt-4 text-muted-foreground">
            By combining alloying elements in copper with rapid quenching,
            de-oxidation, 60–90% cold reduction and an aging treatment, METNMAT
            developed a copper alloy that is both high-strength and highly
            conductive — reaching 91–93% IACS.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "91–93% IACS electrical conductivity",
              "High strength via controlled cold reduction & aging",
              "Oxygen-free, scalable lab-to-industrial process",
            ].map((r) => (
              <li key={r} className="flex items-center gap-3 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                {r}
              </li>
            ))}
          </ul>
          <Button href="/projects" className="mt-8">
            Explore projects
          </Button>
        </div>
      </Container>
    </section>
  );
}
