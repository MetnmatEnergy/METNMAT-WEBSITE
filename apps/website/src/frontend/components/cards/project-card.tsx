import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/frontend/lib/placeholder";

/**
 * Premium case-study card. Links to the project's own /projects/[slug] page.
 * Uses the CMS cover image when present, else an elegant branded fallback so
 * the grid stays polished even before images are uploaded.
 */
export function ProjectCard({
  project,
  priority = false,
}: {
  project: Project;
  priority?: boolean;
}) {
  const highlight = project.highlights?.[0];
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_18px_50px_-24px_hsl(var(--brand)/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Media */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {project.coverUrl ? (
          <Image
            src={project.coverUrl}
            alt={project.coverAlt || project.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            priority={priority}
          />
        ) : (
          <div className="bg-grid absolute inset-0 flex items-center justify-center bg-muted/40">
            <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand/[0.10] via-transparent to-brand/[0.16]" />
            <span aria-hidden className="pointer-events-none select-none font-display text-[6rem] font-bold leading-none text-foreground/[0.05]">
              M
            </span>
          </div>
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        {project.category && (
          <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-foreground/90 backdrop-blur">
            {project.category}
          </span>
        )}
        {highlight && (
          <span className="absolute bottom-4 left-4 rounded-full bg-brand/90 px-3 py-1 text-[11px] font-semibold tracking-wide text-brand-foreground shadow-sm">
            {highlight.value}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-brand">
          {project.title}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {project.summary}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/90 transition-colors group-hover:text-brand">
          View project
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>
    </Link>
  );
}
