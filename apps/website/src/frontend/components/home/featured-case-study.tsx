import Link from "next/link";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Badge } from "@/frontend/components/ui/badge";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { Project } from "@/frontend/lib/placeholder";

/**
 * Homepage "Featured case study" spotlight. Which project appears is picked in
 * the CMS (Homepage global → Featured project; falls back to the first project
 * flagged Featured, then the first project). All copy, image and highlights
 * come from that project's CMS record.
 */
export function FeaturedCaseStudy({ project }: { project: Project }) {
  const href = `/projects/${project.slug}`;
  const highlights = (project.highlights ?? []).slice(0, 3);
  return (
    <section className="section border-y border-border bg-surface/40">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <Link href={href} className="group block overflow-hidden rounded-2xl" aria-label={project.title}>
          <MediaPlaceholder
            className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.02]"
            src={project.coverUrl}
            alt={project.coverAlt ?? project.title}
            label="Featured case study"
          />
        </Link>
        <div>
          <Badge variant="brand">Featured case study</Badge>
          <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            <Link href={href} className="transition-colors hover:text-brand">
              {project.title}
            </Link>
          </h2>
          <p className="mt-4 text-muted-foreground">{project.summary}</p>
          {highlights.length > 0 && (
            <ul className="mt-6 space-y-3 text-sm">
              {highlights.map((h) => (
                <li key={`${h.label}-${h.value}`} className="flex items-center gap-3 text-muted-foreground">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <span>
                    <span className="font-medium text-foreground/90">{h.value}</span> {h.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Button href="/projects" className="mt-8">
            Explore projects
          </Button>
        </div>
      </Container>
    </section>
  );
}
