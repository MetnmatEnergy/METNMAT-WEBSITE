import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Badge } from "@/frontend/components/ui/badge";
import { ProjectCard } from "@/frontend/components/cards/project-card";
import { CtaBand } from "@/frontend/components/home/cta";
import { getProjects } from "@/frontend/lib/cms";
import { pageMetadata } from "@/frontend/lib/seo";
import { JsonLd } from "@/frontend/components/seo/json-ld";
import { site } from "@/frontend/lib/site";
import type { Project } from "@/frontend/lib/placeholder";

export const metadata: Metadata = pageMetadata({
  title: "Projects & Case Studies",
  description:
    "Explore METNMAT's delivered R&D — high-conductivity copper alloys, high-temperature materials, metal foams and composites, and thermoelectric waste-heat recovery, from lab to industrial scale.",
  path: "/projects",
});

type SearchParams = { category?: string | string[] };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [projects, params] = await Promise.all([getProjects(), searchParams]);

  const categories = Array.from(new Set(projects.map((p) => p.category).filter(Boolean)));
  const raw = Array.isArray(params.category) ? params.category[0] : params.category;
  const active = raw && categories.includes(raw) ? raw : "All";

  const filtered = active === "All" ? projects : projects.filter((p) => p.category === active);
  // Curated spotlight (featured, else first) only on the unfiltered view.
  const spotlight = active === "All" ? projects.find((p) => p.featured) ?? projects[0] : undefined;
  const grid = spotlight ? filtered.filter((p) => p.slug !== spotlight.slug) : filtered;

  const filterHref = (cat: string) => (cat === "All" ? "/projects" : `/projects?category=${encodeURIComponent(cat)}`);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Projects & Case Studies · METNMAT",
          url: `${site.url}/projects`,
          hasPart: projects.slice(0, 25).map((p) => ({
            "@type": "CreativeWork",
            name: p.title,
            url: `${site.url}/projects/${p.slug}`,
            about: p.category,
          })),
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="bg-hero-glow pointer-events-none absolute inset-0" />
        {/* Compact hero: presence comes from the display type, not padding —
            the filter row below owns the gap (its section pt is zeroed). */}
        <Container className="relative pb-6 pt-8 sm:pb-8 sm:pt-10 lg:pb-10 lg:pt-12">
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span aria-hidden>/</span>
            <span className="text-foreground">Projects</span>
          </nav>
          <Badge variant="brand">Our Work</Badge>
          <h1 className="mt-4 max-w-4xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Projects &amp; Case Studies
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
            A selection of METNMAT&apos;s research and engineering work — from high-conductivity
            copper alloys and high-temperature materials to metal foams, composites and
            thermoelectric waste-heat recovery — taken from concept to industrial scale.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-brand">{projects.length}</span>
              <span className="text-muted-foreground">case studies</span>
            </p>
            <span className="hidden h-8 w-px bg-border sm:block" aria-hidden />
            <p className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-brand">{categories.length}</span>
              <span className="text-muted-foreground">focus areas</span>
            </p>
          </div>
        </Container>
      </section>

      {/* Filter + grid — pt-0: the hero's bottom padding already provides the
          gap, so the section's own top padding would double it. */}
      <section className="section pt-0">
        <Container>
          <nav aria-label="Filter projects by focus area" className="flex flex-wrap gap-2">
            {["All", ...categories].map((cat) => {
              const isActive = cat === active;
              return (
                <Link
                  key={cat}
                  href={filterHref(cat)}
                  scroll={false}
                  aria-current={isActive ? "true" : undefined}
                  className={
                    isActive
                      ? "rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground"
                      : "rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                  }
                >
                  {cat}
                </Link>
              );
            })}
          </nav>

          {spotlight && <FeaturedProject project={spotlight} />}

          <div className="mb-5 mt-10 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">
              {active === "All" ? "All case studies" : active}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length === 1 ? "1 project" : `${filtered.length} projects`}
            </p>
          </div>

          {grid.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {grid.map((project, i) => (
                <ProjectCard key={project.slug} project={project} priority={i < 3 && !spotlight} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-display text-lg font-semibold">No projects in this area yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Browse all case studies or explore another focus area.
              </p>
              <Link href="/projects" className="mt-6 inline-block rounded-full border border-border px-5 py-2 text-sm font-medium hover:border-brand/40 hover:text-foreground">
                View all projects
              </Link>
            </div>
          )}
        </Container>
      </section>

      <CtaBand />
    </>
  );
}

/** Wide curated spotlight shown above the grid on the unfiltered view. */
function FeaturedProject({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group mt-6 grid overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300 hover:border-brand/40 hover:shadow-[0_24px_70px_-30px_hsl(var(--brand)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:grid-cols-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto">
        {project.coverUrl ? (
          <Image
            src={project.coverUrl}
            alt={project.coverAlt || project.title}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            priority
          />
        ) : (
          <div className="bg-grid absolute inset-0 flex items-center justify-center bg-muted/40">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand/[0.12] via-transparent to-brand/[0.20]" />
            <span aria-hidden className="pointer-events-none select-none font-display text-[10rem] font-bold leading-none text-foreground/[0.05]">
              M
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-4 p-8 lg:p-12">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand-soft">
            Featured
          </span>
          {project.category && (
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {project.category}
            </span>
          )}
        </div>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tight transition-colors group-hover:text-brand sm:text-3xl">
          {project.title}
        </h2>
        {project.subtitle && <p className="text-base text-foreground/70">{project.subtitle}</p>}
        <p className="text-sm leading-relaxed text-muted-foreground">{project.summary}</p>
        {project.highlights && project.highlights.length > 0 && (
          <dl className="mt-1 flex flex-wrap gap-x-8 gap-y-3">
            {project.highlights.map((h) => (
              <div key={h.label}>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{h.label}</dt>
                <dd className="font-display text-lg font-bold text-foreground">{h.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/90 transition-colors group-hover:text-brand">
          Read the case study
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
