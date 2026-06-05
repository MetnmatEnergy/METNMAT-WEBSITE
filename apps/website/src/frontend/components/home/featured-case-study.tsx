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
          {/* TODO(content): headline metric + story for the flagship project. */}
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Headline outcome of your flagship project
          </h2>
          <p className="mt-4 text-muted-foreground">
            Two to three lines summarizing the challenge, the approach and the
            measurable result. Replace with the approved case study narrative.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {["Key result one", "Key result two", "Key result three"].map((r) => (
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
