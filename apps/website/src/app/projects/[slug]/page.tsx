import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { draftMode } from "next/headers";
import { ArrowLeft, Building2, Calendar, Tag } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Badge } from "@/frontend/components/ui/badge";
import { ProjectCard } from "@/frontend/components/cards/project-card";
import { CtaBand } from "@/frontend/components/home/cta";
import { RichText, hasRichText } from "@/frontend/components/blog/rich-text";
import { JsonLd } from "@/frontend/components/seo/json-ld";
import { getProjects, getProjectFull } from "@/frontend/lib/cms";
import { pageMetadata } from "@/frontend/lib/seo";
import { site } from "@/frontend/lib/site";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectFull(slug);
  if (!project) {
    // Metadata resolves BEFORE the page streams, so an unknown slug must 404
    // here to get a real 404 status. Reading a dynamic request API (draftMode)
    // first makes this render dynamic so notFound() commits the status —
    // exactly the mechanism the blog article route uses.
    await draftMode();
    notFound();
  }
  const meta = pageMetadata({
    title: project.seoTitle || project.title,
    description: project.metaDescription || project.summary,
    path: `/projects/${slug}`,
  });
  // Staff can point the canonical at the original source when this case study
  // canonically lives elsewhere (CMS → SEO → externalUrl).
  if (project.externalUrl) {
    meta.alternates = { ...meta.alternates, canonical: project.externalUrl };
  }
  return meta;
}

export default async function ProjectDetailPage({ params }: { params: Promise<Params> }) {
  // Read a dynamic request API up front so the route always renders
  // per-request — this is what makes notFound() return a real 404 for an
  // unknown slug (mirrors the blog article route).
  await draftMode();
  const { slug } = await params;
  const project = await getProjectFull(slug);
  if (!project) notFound();

  const related = (await getProjects())
    .filter((p) => p.slug !== project.slug && p.category === project.category)
    .slice(0, 3);

  const facts = [
    project.category && { icon: Tag, label: "Focus area", value: project.category },
    project.client && { icon: Building2, label: "Client", value: project.client },
    project.year && { icon: Calendar, label: "Year", value: String(project.year) },
  ].filter(Boolean) as { icon: typeof Tag; label: string; value: string }[];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CreativeWork",
          headline: project.title,
          name: project.title,
          description: project.summary,
          about: project.category,
          url: `${site.url}/projects/${project.slug}`,
          ...(project.year ? { dateCreated: String(project.year) } : {}),
          publisher: { "@type": "Organization", name: "METNMAT", url: site.url },
          ...(project.coverUrl ? { image: project.coverUrl } : {}),
        }}
      />

      {/* Header */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="bg-hero-glow pointer-events-none absolute inset-0" />
        <Container className="relative py-12 sm:py-16">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span aria-hidden>/</span>
            <Link href="/projects" className="hover:text-foreground">Projects</Link>
            <span aria-hidden>/</span>
            <span className="truncate text-foreground">{project.title}</span>
          </nav>

          {project.category && (
            <div className="mt-6">
              <Badge variant="brand">{project.category}</Badge>
            </div>
          )}
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
            {project.title}
          </h1>
          {project.subtitle && (
            <p className="mt-4 max-w-2xl text-lg text-foreground/70">{project.subtitle}</p>
          )}
          {project.tags && project.tags.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {project.tags.map((tag) => (
                <li key={tag} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      {/* Cover */}
      <Container className="relative -mt-px">
        {/* 2:1 (not 21:9) on larger screens: the composed covers carry baked-in
            titles near the top — a 21:9 centre crop clips them on 16:9 art. */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-b-3xl border-x border-b border-border sm:aspect-[2/1]">
          {project.coverUrl ? (
            <Image
              src={project.coverUrl}
              alt={project.coverAlt || project.title}
              fill
              sizes="(max-width: 1280px) 100vw, 1152px"
              className="object-cover"
              priority
            />
          ) : (
            <div className="bg-grid absolute inset-0 flex items-center justify-center bg-muted/40">
              <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand/[0.10] via-transparent to-brand/[0.18]" />
              <span aria-hidden className="pointer-events-none select-none font-display text-[12rem] font-bold leading-none text-foreground/[0.05]">
                M
              </span>
            </div>
          )}
        </div>
      </Container>

      {/* Highlights */}
      {project.highlights && project.highlights.length > 0 && (
        <Container className="mt-10">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {project.highlights.map((h) => (
              <div key={h.label} className="rounded-2xl border border-border bg-surface p-6">
                <dt className="text-xs uppercase tracking-widest text-muted-foreground">{h.label}</dt>
                <dd className="mt-2 font-display text-2xl font-bold text-brand">{h.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      )}

      {/* Body + sidebar */}
      <section className="section">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
            <article className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight">Overview</h2>
              <div className="mt-6">
                {hasRichText(project.body) ? (
                  <RichText content={project.body} />
                ) : (
                  <p className="text-base leading-relaxed text-muted-foreground">{project.summary}</p>
                )}
              </div>

              {/* Gallery */}
              {project.gallery && project.gallery.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-display text-xl font-bold tracking-tight">Gallery</h2>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {project.gallery.map((g, i) => (
                      <figure key={i} className="overflow-hidden rounded-2xl border border-border">
                        <div className="relative aspect-[4/3]">
                          <Image src={g.url as string} alt={g.alt || project.title} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                        </div>
                        {g.caption && (
                          <figcaption className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                            {g.caption}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* Sidebar */}
            <aside className="lg:sticky lg:top-28 lg:self-start">
              {facts.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-6">
                  <h2 className="font-display text-base font-semibold">At a glance</h2>
                  <dl className="mt-4 space-y-4">
                    {facts.map((f) => (
                      <div key={f.label}>
                        <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                          <f.icon aria-hidden className="h-4 w-4 shrink-0 text-brand" />
                          {f.label}
                        </dt>
                        <dd className="mt-1 pl-6 text-sm font-medium text-foreground">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              <div className="mt-6 rounded-2xl border border-brand/25 bg-brand/[0.06] p-6">
                <h2 className="font-display text-base font-semibold">Have a similar challenge?</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Tell us about your process and goals — we&apos;ll scope the R&amp;D path from
                  prototype to production.
                </p>
                <Link
                  href="/quote"
                  className="mt-4 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-soft"
                >
                  Discuss your project
                </Link>
              </div>
            </aside>
          </div>

          <div className="mt-12">
            <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> All projects
            </Link>
          </div>
        </Container>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="section pt-0">
          <Container>
            <h2 className="font-display text-2xl font-bold tracking-tight">Related projects</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
          </Container>
        </section>
      )}

      <CtaBand />
    </>
  );
}
