import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { JsonLd } from "@/frontend/components/seo/json-ld";
import { blogPosts } from "@/frontend/lib/placeholder";

type Params = { slug: string };

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  return {
    title: post?.title ?? "Article",
    description: post?.excerpt,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);

  return (
    <article className="section">
      {post && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.excerpt,
            articleSection: post.category,
            datePublished: post.date,
          }}
        />
      )}
      <Container className="max-w-3xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to blog
        </Link>

        <div className="mt-6 text-xs font-semibold uppercase tracking-widest text-brand-soft">
          {post?.category ?? "Category"}
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
          {/* TODO(content): article body comes from CMS/markdown. */}
          {post?.title ?? "Article title"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {post?.readingTime ?? "— min read"}
        </p>

        <MediaPlaceholder className="mt-8 aspect-video" label="Cover image" />

        <div className="prose-invert mt-8 space-y-4 text-muted-foreground">
          <p>Article body paragraph. Replace this with real content.</p>
          <p>Article body paragraph. Replace this with real content.</p>
        </div>
      </Container>
    </article>
  );
}
