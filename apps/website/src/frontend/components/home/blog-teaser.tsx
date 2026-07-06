import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { ArticleCard } from "@/frontend/components/blog/article-card";
import type { BlogArticleCard } from "@/frontend/lib/blog";

/**
 * Homepage teaser — the latest published articles rendered with the same
 * cover-image cards as the /blog listing. Hidden entirely when there are no
 * public articles (empty CMS results must render empty).
 */
export function BlogTeaser({ posts = [] }: { posts?: BlogArticleCard[] } = {}) {
  if (!posts.length) return null;
  return (
    <section className="section border-t border-border bg-surface/40">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Insights"
            title="From the lab"
            description="Research notes, technical deep-dives and updates from the METNMAT lab."
          />
          <Button href="/blog" variant="outline" size="sm">
            All articles
          </Button>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {posts.slice(0, 3).map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </Container>
    </section>
  );
}
