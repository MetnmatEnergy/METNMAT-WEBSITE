import { Container } from "@/frontend/components/ui/container";
import { Badge } from "@/frontend/components/ui/badge";
import { PageBreadcrumbs } from "@/frontend/components/seo/page-breadcrumbs";

/** Compact hero used at the top of inner pages. */
export function PageHero({
  eyebrow,
  title,
  description,
  bordered = true,
  breadcrumbs,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Bottom divider line. Set false to let the hero flow into the next section. */
  bordered?: boolean;
  /** Trail ending with this page. Renders the visible crumbs + BreadcrumbList. */
  breadcrumbs?: { name: string; path: string }[];
}) {
  return (
    <section className={`relative overflow-hidden${bordered ? " border-b border-border" : ""}`}>
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="bg-hero-glow pointer-events-none absolute inset-0" />
      <Container className="relative py-12 sm:py-16 lg:py-20">
        {breadcrumbs && <PageBreadcrumbs items={breadcrumbs} className="mb-5" />}
        {eyebrow && <Badge variant="brand">{eyebrow}</Badge>}
        <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
            {description}
          </p>
        )}
      </Container>
    </section>
  );
}
