import Link from "next/link";
import { Eye, ThumbsUp } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { BlogArticleCard } from "@/frontend/lib/blog";

export function formatArticleDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const count = (n: number): string =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);

/**
 * Article result card — scholarly-compact: type + category eyebrow, title,
 * excerpt, author/affiliation, then date · reading time · metrics.
 */
export function ArticleCard({ article, headingLevel = 3 }: { article: BlogArticleCard; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <MediaPlaceholder
        className="aspect-video rounded-none border-0"
        label="Article"
        src={article.coverUrl}
        alt={article.coverAlt ?? article.title}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-widest">
          {article.contentTypeName && <span className="text-brand-soft">{article.contentTypeName}</span>}
          <span className="text-muted-foreground">{article.categoryName}</span>
          {article.isEditorsPick && (
            <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] text-brand-soft">
              Editor&apos;s Pick
            </span>
          )}
        </div>
        <Heading className="mt-2 font-display text-lg font-semibold leading-snug">
          <Link
            href={`/blog/${article.slug}`}
            className="outline-none after:absolute after:inset-0 focus-visible:text-brand-soft"
          >
            {article.title}
          </Link>
        </Heading>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {article.excerpt}
        </p>
        <p className="mt-4 text-sm font-medium text-foreground/90">
          {article.authorLine}
          {article.affiliationLine && (
            <span className="block text-xs font-normal text-muted-foreground">{article.affiliationLine}</span>
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {article.date && <time dateTime={article.date}>{formatArticleDate(article.date)}</time>}
          {article.readingTime && <span>· {article.readingTime}</span>}
          {article.viewCount > 0 && (
            <span className="inline-flex items-center gap-1">
              · <Eye aria-hidden className="h-3.5 w-3.5" /> {count(article.viewCount)}
              <span className="sr-only">views</span>
            </span>
          )}
          {article.likeCount > 0 && (
            <span className="inline-flex items-center gap-1">
              · <ThumbsUp aria-hidden className="h-3.5 w-3.5" /> {count(article.likeCount)}
              <span className="sr-only">likes</span>
            </span>
          )}
        </div>
        {article.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
            {article.tags.slice(0, 4).map((t) => (
              <li key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
