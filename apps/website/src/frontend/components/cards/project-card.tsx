import Link from "next/link";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { Project } from "@/frontend/lib/placeholder";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects#${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
    >
      <MediaPlaceholder className="aspect-video rounded-none border-0" label="Case study" />
      <div className="flex flex-1 flex-col p-6">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-soft">
          {project.category}
        </span>
        <h3 className="mt-2 font-display text-xl font-semibold">{project.title}</h3>
        <p className="mt-2 flex-1 text-sm text-muted-foreground">{project.summary}</p>
        <span className="mt-4 text-sm font-medium text-foreground/90 group-hover:text-brand">
          Read case study →
        </span>
      </div>
    </Link>
  );
}
