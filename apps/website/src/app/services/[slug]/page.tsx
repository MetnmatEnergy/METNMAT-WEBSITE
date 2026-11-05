import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { PageHero } from "@/frontend/components/layout/page-hero";
import { ArticleSections } from "@/frontend/components/content/article-sections";
import { CtaBand } from "@/frontend/components/home/cta";
import { JsonLd, faqJsonLd, organizationJsonLd, organizationRef } from "@/frontend/components/seo/json-ld";
import { SERVICE_PAGES } from "@/frontend/lib/service-pages";
import { pageMetadata } from "@/frontend/lib/seo";
import { site } from "@/frontend/lib/site";

type Params = { slug: string };

// The loading state lives in the (index) group, so these pages arrive whole. Under
// a Suspense boundary their text would stream in after the shell, and notFound()
// would answer 200. Listing the slugs makes an unknown one a true 404.
export const dynamicParams = false;

const find = (slug: string) => (Object.hasOwn(SERVICE_PAGES, slug) ? SERVICE_PAGES[slug] : undefined);

export function generateStaticParams() {
  return Object.keys(SERVICE_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = find(slug);
  if (!page) notFound();
  return pageMetadata({ title: page.title, description: page.description, path: `/services/${slug}`, keywords: page.keywords });
}

export default async function ServiceLandingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = find(slug);
  if (!page) notFound();
  const path = `/services/${slug}`;

  return (
    <>
      <JsonLd data={organizationJsonLd} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: page.h1,
          description: page.description,
          url: `${site.url}${path}`,
          provider: organizationRef,
          areaServed: { "@type": "Country", name: "India" },
        }}
      />
      <JsonLd data={faqJsonLd(page.faqs)} />
      <PageHero
        eyebrow="Service"
        title={page.h1}
        bordered={false}
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Services", path: "/services" },
          { name: page.h1, path },
        ]}
      />
      <Container className="max-w-3xl pb-16">
        <p className="rounded-2xl border border-border bg-surface/40 p-5 text-foreground">{page.answer}</p>
        <div className="mt-6">
          <Button href="/quote">Request a quote</Button>
        </div>
        <ArticleSections sections={page.sections} faqs={page.faqs} links={page.links} />
      </Container>
      <CtaBand />
    </>
  );
}
