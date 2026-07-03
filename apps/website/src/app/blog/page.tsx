import type { Metadata } from "next";
import { Suspense } from "react";
import { PenLine } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { Pagination } from "@/frontend/components/commerce/pagination";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { ArticleCard } from "@/frontend/components/blog/article-card";
import { FeaturedArticles } from "@/frontend/components/blog/featured-articles";
import { BlogToolbar } from "@/frontend/components/blog/blog-toolbar";
import { pageMetadata } from "@/frontend/lib/seo";
import { site } from "@/frontend/lib/site";
import { hasActiveFilters, parseBlogQuery, BLOG_PAGE_SIZE } from "@/frontend/lib/blog-query";
import {
  getBlogAuthorOptions,
  getBlogCategories,
  getBlogContentTypes,
  getBlogYears,
  getFeaturedBlogArticles,
  listBlogArticles,
} from "@/frontend/lib/blog";

const baseMetadata = pageMetadata({
  title: "Research & Engineering Insights",
  description:
    "Explore technical articles, research notes, industrial case studies and engineering insights across metallurgy, materials science, electrochemistry, hydrogen and advanced manufacturing.",
  path: "/blog",
});

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { page } = parseBlogQuery(await searchParams);
  return {
    ...baseMetadata,
    alternates: {
      ...baseMetadata.alternates,
      // Paginated pages canonicalise to themselves — pointing pages 2+ at
      // page 1 would tell crawlers to ignore everything beyond the first page.
      ...(page > 1 ? { canonical: `/blog?page=${page}` } : {}),
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = parseBlogQuery(await searchParams);
  const filtered = hasActiveFilters(query);

  const [categories, contentTypes, authors, years, listing, featured] = await Promise.all([
    getBlogCategories(),
    getBlogContentTypes(),
    getBlogAuthorOptions(),
    getBlogYears(),
    listBlogArticles(query),
    !filtered && query.page === 1 ? getFeaturedBlogArticles() : Promise.resolve([]),
  ]);

  // Don't repeat featured articles inside the grid directly below them.
  const featuredIds = new Set(featured.map((f) => f.id));
  const gridArticles = featured.length
    ? listing.articles.filter((a) => !featuredIds.has(a.id))
    : listing.articles;

  const start = (listing.page - 1) * BLOG_PAGE_SIZE + 1;
  const end = Math.min(listing.totalDocs, listing.page * BLOG_PAGE_SIZE);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "METNMAT Research & Engineering Insights",
          description:
            "Technical articles, research notes, engineering guides, case studies and industrial insights from METNMAT and contributing researchers.",
          url: `${site.url}/blog`,
          publisher: { "@type": "Organization", name: "METNMAT Research & Innovations", url: site.url },
        }}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }])} />

      <section className="border-b border-border bg-surface/50">
        <Container className="py-10 md:py-14">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                METNMAT Research &amp; Engineering Insights
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                Technical articles, research notes, engineering guides, case studies and industrial
                insights from METNMAT and contributing researchers.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href="/blog/submit" size="md">
                <PenLine aria-hidden className="h-4 w-4" /> Request to Publish
              </Button>
              <Button href="/quote" variant="outline" size="md">
                Discuss an R&amp;D project
              </Button>
            </div>
          </div>
          <div className="mt-8">
            <Suspense>
              <BlogToolbar
                categories={categories}
                contentTypes={contentTypes}
                authors={authors}
                years={years}
              />
            </Suspense>
          </div>
        </Container>
      </section>

      <section className="section">
        <Container>
          {featured.length > 0 && <FeaturedArticles articles={featured} />}

          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">
              {filtered ? "Results" : "Latest articles"}
            </h2>
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {listing.totalDocs === 0
                ? null
                : listing.totalDocs === 1
                  ? "1 article"
                  : featured.length
                    ? `${listing.totalDocs} articles` // grid is deduped against the featured rail — a range would mislead
                    : `${start}–${end} of ${listing.totalDocs} articles`}
            </p>
          </div>

          {gridArticles.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {gridArticles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : listing.articles.length > 0 ? (
            // Everything on this page is already shown in the featured rail.
            <p className="text-sm text-muted-foreground">
              All current articles are featured above.
            </p>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
              <p className="font-display text-lg font-semibold">
                {filtered ? "No articles match your search" : "No articles published yet"}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {filtered
                  ? "Try different keywords, or clear the filters to browse all published articles."
                  : "Our team is preparing technical articles and research notes — check back soon."}
              </p>
              {filtered && (
                <Button href="/blog" variant="outline" className="mt-6">
                  Clear search &amp; filters
                </Button>
              )}
            </div>
          )}

          {listing.totalPages > 1 && (
            <div className="mt-12">
              <Suspense>
                <Pagination current={listing.page} total={listing.totalPages} />
              </Suspense>
            </div>
          )}

          <div className="mt-16 rounded-2xl border border-border bg-surface p-6 md:flex md:items-center md:justify-between md:p-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-lg font-semibold">Publish with METNMAT</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Researchers, engineers and technical professionals may submit an article proposal
                for editorial review — technical articles, research notes, case studies and more.
              </p>
            </div>
            <Button href="/blog/submit" variant="outline" className="mt-4 md:mt-0">
              <PenLine aria-hidden className="h-4 w-4" /> Request to Publish
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
