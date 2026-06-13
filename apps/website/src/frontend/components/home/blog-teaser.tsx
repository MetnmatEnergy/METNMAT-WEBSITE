import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { BlogCard } from "@/frontend/components/cards/blog-card";
import { blogPosts as phBlogPosts, type BlogPost } from "@/frontend/lib/placeholder";

export function BlogTeaser({ posts = phBlogPosts }: { posts?: BlogPost[] } = {}) {
  const blogPosts = posts;
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
          {blogPosts.slice(0, 3).map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </Container>
    </section>
  );
}
