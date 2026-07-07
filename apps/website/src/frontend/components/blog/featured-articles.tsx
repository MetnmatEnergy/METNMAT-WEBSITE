import Link from "next/link";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { BlogArticleCard } from "@/frontend/lib/blog";
import { formatArticleDate } from "./article-card";

/**
 * Featured rail: one primary article + up to three compact secondaries.
 * Rendered only when the CMS actually has featured/editor's-pick articles.
 */
export function FeaturedArticles({ articles }: { articles: BlogArticleCard[] }) {
  if (!articles.length) return null;
  const [primary, ...rest] = articles;
  const secondaries = rest.slice(0, 3);

  return (
    <section aria-labelledby="featured-heading" className="mb-10">
      <h2 id="featured-heading" className="sr-only">
        Featured articles
      </h2>
      <div className="grid gap-6 lg:grid-cols-5">
        <article className="group relative overflow-hidden rounded-2xl border border-border bg-surface lg:col-span-3">
          <MediaPlaceholder
            className="aspect-[16/8] rounded-none border-0"
            label="Featured article"
            src={primary.coverUrl}
            alt={primary.coverAlt ?? primary.title}
            sizes="(max-width: 1024px) 100vw, 60vw"
          />
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-widest">
              <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold text-brand-foreground">
                Featured
              </span>
              {primary.contentTypeName && <span className="text-brand-soft">{primary.contentTypeName}</span>}
              <span className="text-muted-foreground">{primary.categoryName}</span>
            </div>
            <h3 className="mt-3 font-display text-2xl font-bold leading-tight md:text-3xl">
              <Link href={`/blog/${primary.slug}`} className="outline-none after:absolute after:inset-0 focus-visible:text-brand-soft">
                {primary.title}
              </Link>
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {primary.excerpt}
            </p>
            <p className="mt-4 text-sm text-foreground/90">
              {primary.authorLine}
              <span className="text-muted-foreground">
                {primary.date ? ` · ${formatArticleDate(primary.date)}` : ""}
                {primary.readingTime ? ` · ${primary.readingTime}` : ""}
              </span>
            </p>
          </div>
        </article>

        {secondaries.length > 0 && (
          <div className="flex flex-col gap-4 lg:col-span-2">
            {secondaries.map((a) => (
              <article
                key={a.id}
                className="group relative flex gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand/40"
              >
                <MediaPlaceholder
                  className="hidden aspect-square w-24 shrink-0 sm:block"
                  label="Article"
                  src={a.coverUrl}
                  alt={a.coverAlt ?? a.title}
                  sizes="96px"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-widest text-brand-soft">
                    {a.contentTypeName ?? a.categoryName}
                  </div>
                  <h3 className="mt-1 font-display text-base font-semibold leading-snug">
                    <Link href={`/blog/${a.slug}`} className="outline-none after:absolute after:inset-0 focus-visible:text-brand-soft">
                      {a.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.authorLine}
                    {a.date ? ` · ${formatArticleDate(a.date)}` : ""}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
