import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { Download, ExternalLink, Eye, PenLine } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { RichText, hasRichText } from "@/frontend/components/blog/rich-text";
import { ArticleCard, formatArticleDate } from "@/frontend/components/blog/article-card";
import { AuthorsBlock } from "@/frontend/components/blog/authors-block";
import { ReferencesSection } from "@/frontend/components/blog/references-section";
import { TableOfContents } from "@/frontend/components/blog/toc";
import { ReactionButtons } from "@/frontend/components/blog/reaction-buttons";
import { ShareActions } from "@/frontend/components/blog/share-actions";
import { ViewTracker } from "@/frontend/components/blog/view-tracker";
import { AnalyticsEntity } from "@/frontend/lib/analytics/entity";
import { extractToc } from "@/frontend/lib/blog-toc";
import { site } from "@/frontend/lib/site";
import {
  getBlogArticle,
  getRelatedBlogArticles,
  mapCmsArticleFull,
  resolveBlogSlugRedirect,
  type BlogArticleFull,
} from "@/frontend/lib/blog";
import { getDraftArticleRaw } from "@/backend/services/blog.service";

type Params = { slug: string };

async function loadArticle(slug: string): Promise<{ article: BlogArticleFull | null; preview: boolean }> {
  const { isEnabled } = await draftMode();
  if (isEnabled) {
    const raw = await getDraftArticleRaw(slug);
    if (raw) return { article: mapCmsArticleFull(raw), preview: true };
  }
  return { article: await getBlogArticle(slug), preview: false };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getBlogArticle(slug);
  if (!article) {
    // Metadata resolves BEFORE the page streams, so this is where a missing
    // slug must 301 (renamed article) or 404 with a real status code. Draft
    // previews (no published version) fall through to the page's draft fetch.
    const { isEnabled } = await draftMode();
    if (isEnabled) return { title: "Draft preview", robots: { index: false } };
    const target = await resolveBlogSlugRedirect(slug);
    if (target && target !== slug) permanentRedirect(`/blog/${target}`);
    notFound();
  }
  const title = article.seoTitle ?? article.title;
  const description = article.metaDescription ?? article.excerpt;
  return {
    title,
    description,
    alternates: { canonical: article.canonicalUrl ?? `${site.url}/blog/${article.slug}` },
    ...(article.noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      type: "article",
      url: `${site.url}/blog/${article.slug}`,
      siteName: "METNMAT Research & Innovations",
      ...(article.date ? { publishedTime: article.date } : {}),
      ...(article.updatedAt ? { modifiedTime: article.updatedAt } : {}),
      authors: article.authors.length
        ? article.authors.map((a) => a.name)
        : article.legacyAuthor
          ? [article.legacyAuthor]
          : undefined,
      ...(article.ogImageUrl ? { images: [{ url: article.ogImageUrl }] } : {}),
    },
    twitter: {
      card: article.ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const { article, preview } = await loadArticle(slug);

  if (!article) {
    // Renamed article? 301 old indexed URLs to the current slug.
    const target = await resolveBlogSlugRedirect(slug);
    if (target && target !== slug) permanentRedirect(`/blog/${target}`);
    notFound();
  }

  const toc = extractToc(article.body);
  const related = await getRelatedBlogArticles(article);
  const isTech = ["technical-article", "research-note", "experimental-method", "review-article"].includes(
    article.contentTypeSlug ?? "",
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isTech ? "TechArticle" : "BlogPosting",
    headline: article.title,
    description: article.metaDescription ?? article.excerpt,
    ...(article.abstract ? { abstract: article.abstract } : {}),
    articleSection: article.categoryName,
    ...(article.keywords ? { keywords: article.keywords } : {}),
    ...(article.date ? { datePublished: article.date } : {}),
    ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
    mainEntityOfPage: `${site.url}/blog/${article.slug}`,
    url: `${site.url}/blog/${article.slug}`,
    ...(article.ogImageUrl ? { image: article.ogImageUrl } : {}),
    author: article.authors.length
      ? article.authors.map((a) => ({
          "@type": "Person",
          name: a.name,
          ...(a.organisation ? { affiliation: { "@type": "Organization", name: a.organisation } } : {}),
          ...(a.orcidUrl ? { sameAs: a.orcidUrl } : {}),
        }))
      : { "@type": "Organization", name: site.legalName },
    publisher: {
      "@type": "Organization",
      name: site.legalName,
      url: site.url,
      logo: { "@type": "ImageObject", url: `${site.url}/icon-512.png` },
    },
  };

  return (
    <article className="pb-16">
      <JsonLd data={jsonLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: article.title, path: `/blog/${article.slug}` },
        ])}
      />
      {!preview && <ViewTracker articleId={article.id} />}
      {!preview && <AnalyticsEntity type="blog" slug={article.slug} />}

      {preview && (
        <div className="bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-foreground">
          Draft preview — this version is not public. Close this tab and use the CMS to publish.
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-surface/50">
        <Container className="max-w-4xl py-10 md:py-14">
          <Breadcrumbs
            items={[{ name: "Home", href: "/" }, { name: "Blog", href: "/blog" }, { name: article.title }]}
          />
          <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-widest">
            {article.contentTypeName && (
              <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-brand-soft">
                {article.contentTypeName}
              </span>
            )}
            {article.categorySlug ? (
              <Link
                href={`/blog?category=${article.categorySlug}`}
                className="rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
              >
                {article.categoryName}
              </Link>
            ) : (
              <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                {article.categoryName}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="mt-3 text-lg leading-relaxed text-foreground/80">{article.subtitle}</p>
          )}
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {article.excerpt}
          </p>

          <dl className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <div>
              <dt className="sr-only">Authors</dt>
              <dd className="font-medium text-foreground">{article.authorLine}</dd>
            </div>
            {article.date && (
              <div>
                <dt className="sr-only">Published</dt>
                <dd>
                  <time dateTime={article.date}>{formatArticleDate(article.date)}</time>
                </dd>
              </div>
            )}
            {article.updatedAt && article.date && article.updatedAt.slice(0, 10) !== article.date.slice(0, 10) && (
              <div>
                <dt className="sr-only">Updated</dt>
                <dd>Updated {formatArticleDate(article.updatedAt)}</dd>
              </div>
            )}
            {article.readingTime && (
              <div>
                <dt className="sr-only">Reading time</dt>
                <dd>{article.readingTime}</dd>
              </div>
            )}
            {article.viewCount > 0 && (
              <div className="inline-flex items-center gap-1">
                <Eye aria-hidden className="h-4 w-4" />
                <dt className="sr-only">Views</dt>
                <dd>
                  {article.viewCount.toLocaleString("en-IN")} view{article.viewCount === 1 ? "" : "s"}
                </dd>
              </div>
            )}
            {article.doi && (
              <div>
                <dt className="sr-only">DOI</dt>
                <dd>
                  <a
                    href={`https://doi.org/${encodeURIComponent(article.doi)}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-brand underline underline-offset-4 hover:text-brand-soft"
                  >
                    doi:{article.doi}
                  </a>
                </dd>
              </div>
            )}
            {article.externalPublicationUrl && (
              <div>
                <dt className="sr-only">External publication</dt>
                <dd>
                  <a
                    href={article.externalPublicationUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1 text-brand underline underline-offset-4 hover:text-brand-soft"
                  >
                    Original publication <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </Container>
      </header>

      {/* ── Body + TOC rail ─────────────────────────────────────────────────── */}
      <Container className="mt-10">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="mx-auto w-full max-w-3xl">
            {(article.coverUrl || !hasRichText(article.body)) && (
              <figure className="mb-8">
                <MediaPlaceholder
                  className="aspect-video"
                  label="Cover image"
                  src={article.coverUrl}
                  alt={article.coverAlt ?? article.title}
                  sizes="(max-width: 768px) 100vw, 768px"
                />
                {article.coverCaption && (
                  <figcaption className="mt-2 text-center text-sm text-muted-foreground">
                    {article.coverCaption}
                  </figcaption>
                )}
              </figure>
            )}

            <div className="lg:hidden">
              <TableOfContents entries={toc} />
            </div>

            {(article.abstract || article.keywords || article.researchArea || article.referenceNumber) && (
              <section
                aria-label="Article metadata"
                className="mt-6 rounded-2xl border border-border bg-surface p-5 md:p-6"
              >
                {article.abstract && (
                  <>
                    <h2 className="font-display text-base font-semibold">Abstract</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{article.abstract}</p>
                  </>
                )}
                <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  {article.keywords && (
                    <div>
                      <dt className="font-medium text-foreground">Keywords</dt>
                      <dd className="text-muted-foreground">{article.keywords}</dd>
                    </div>
                  )}
                  {article.researchArea && (
                    <div>
                      <dt className="font-medium text-foreground">Research area</dt>
                      <dd className="text-muted-foreground">{article.researchArea}</dd>
                    </div>
                  )}
                  {article.referenceNumber && (
                    <div>
                      <dt className="font-medium text-foreground">Reference</dt>
                      <dd className="text-muted-foreground">{article.referenceNumber}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            <div className="mt-8">
              {hasRichText(article.body) ? (
                <RichText content={article.body} />
              ) : (
                <p className="text-lg leading-relaxed text-muted-foreground">{article.excerpt}</p>
              )}
            </div>

            {article.attachments.length > 0 && (
              <section aria-labelledby="downloads-heading" className="mt-10 rounded-2xl border border-border bg-surface p-5">
                <h2 id="downloads-heading" className="font-display text-base font-semibold">
                  Supporting files
                </h2>
                <ul className="mt-3 space-y-2">
                  {article.attachments.map((f) => (
                    <li key={f.url}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-brand underline underline-offset-4 hover:text-brand-soft"
                      >
                        <Download aria-hidden className="h-4 w-4" /> {f.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <ReferencesSection references={article.references} />
            <AuthorsBlock
              authors={article.authors}
              correspondingAuthorId={article.correspondingAuthorId}
              legacyAuthor={article.legacyAuthor}
            />

            {/* ── Actions ──────────────────────────────────────────────────── */}
            <div className="mt-12 flex flex-col gap-6 border-t border-border pt-8 print:hidden sm:flex-row sm:items-start sm:justify-between">
              {article.allowReactions && !preview ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Was this article helpful?</p>
                  <ReactionButtons
                    articleId={article.id}
                    initialLikes={article.likeCount}
                    initialDislikes={article.dislikeCount}
                  />
                </div>
              ) : (
                <div />
              )}
              <ShareActions title={article.title} />
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-surface p-6 print:hidden md:flex md:items-center md:justify-between">
              <div className="max-w-xl">
                <h2 className="font-display text-base font-semibold">Have research worth publishing?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Submit an article proposal for editorial review by the METNMAT team.
                </p>
              </div>
              <Button href="/blog/submit" variant="outline" size="sm" className="mt-4 md:mt-0">
                <PenLine aria-hidden className="h-4 w-4" /> Request to Publish
              </Button>
            </div>
          </div>

          <aside className="hidden lg:block print:hidden">
            <div className="sticky top-28">
              <TableOfContents entries={toc} />
            </div>
          </aside>
        </div>

        {/* ── Related ───────────────────────────────────────────────────────── */}
        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mx-auto mt-16 max-w-6xl print:hidden">
            <h2 id="related-heading" className="font-display text-xl font-semibold">
              Related articles
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </article>
  );
}
