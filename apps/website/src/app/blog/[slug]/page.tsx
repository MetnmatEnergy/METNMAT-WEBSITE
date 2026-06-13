import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { JsonLd } from "@/frontend/components/seo/json-ld";
import { getBlogPosts, getBlogPostBySlug, getBlogPostFull } from "@/frontend/lib/cms";
import { RichText, hasRichText } from "@/frontend/components/blog/rich-text";

type Params = { slug: string };

export async function generateStaticParams() {
  return (await getBlogPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
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
  const post = await getBlogPostFull(slug);

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
          {post?.category ?? "Article"}
        </div>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">
          {post?.title ?? "Article not found"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {[post?.author, post?.readingTime].filter(Boolean).join(" · ") || null}
        </p>

        <MediaPlaceholder
          className="mt-8 aspect-video"
          label="Cover image"
          src={post?.coverUrl}
          alt={post?.title}
        />

        <div className="mt-8">
          {post && hasRichText(post.body) ? (
            <RichText content={post.body} />
          ) : (
            <p className="text-lg leading-relaxed text-muted-foreground">{post?.excerpt}</p>
          )}
        </div>
      </Container>
    </article>
  );
}
