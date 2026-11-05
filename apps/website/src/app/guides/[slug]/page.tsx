import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ArticleSections } from "@/frontend/components/content/article-sections";
import { JsonLd, faqJsonLd, organizationJsonLd, organizationRef, publisherJsonLd } from "@/frontend/components/seo/json-ld";
import { GUIDES, GUIDES_UPDATED } from "@/frontend/lib/guides";
import { pageMetadata } from "@/frontend/lib/seo";
import { site } from "@/frontend/lib/site";

type Params = { slug: string };

const find = (slug: string) => (Object.hasOwn(GUIDES, slug) ? GUIDES[slug] : undefined);

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = find(slug);
  if (!guide) notFound();
  return pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${slug}`, keywords: guide.keywords });
}

export default async function GuidePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const guide = find(slug);
  if (!guide) notFound();
  const path = `/guides/${slug}`;

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: guide.h1,
          description: guide.description,
          url: `${site.url}${path}`,
          dateModified: GUIDES_UPDATED,
          datePublished: GUIDES_UPDATED,
          author: organizationRef,
          publisher: publisherJsonLd,
          keywords: guide.keywords.join(", "),
        }}
      />
      {guide.faqs.length > 0 && <JsonLd data={faqJsonLd(guide.faqs)} />}
      <PageHero
        eyebrow="Guide"
        title={guide.h1}
        bordered={false}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path },
        ]}
      />
      <Container className="max-w-3xl pb-16">
        <p className="rounded-2xl border border-border bg-surface/40 p-5 text-foreground">{guide.answer}</p>

        <ArticleSections sections={guide.sections} faqs={guide.faqs} links={guide.links} />
      </Container>
    </>
  );
}
