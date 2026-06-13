import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { BlogCard } from "@/frontend/components/cards/blog-card";
import { getBlogPosts } from "@/frontend/lib/cms";

export const metadata: Metadata = {
  title: "Blog",
  description: "Research notes, insights and company news.",
};

export default async function BlogPage() {
  const blogPosts = await getBlogPosts();
  const categories = ["All", ...Array.from(new Set(blogPosts.map((p) => p.category).filter(Boolean)))];
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Insights from the lab"
        description="Research notes, technical deep-dives and company updates."
      />

      <section className="section">
        <Container>
          {/* Category filter (UI only — wire up filtering with real data). */}
          <div className="flex flex-wrap gap-2">
            {categories.map((c, i) => (
              <button
                key={c}
                className={
                  i === 0
                    ? "rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground"
                    : "rounded-full border border-border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                }
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
