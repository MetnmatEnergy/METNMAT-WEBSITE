import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { JsonLd, breadcrumbJsonLd, faqJsonLd, itemListJsonLd } from "@/frontend/components/seo/json-ld";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { CategoryGuide } from "@/frontend/components/commerce/category-guide";
import { getAllProducts, getCategoryBySlug } from "@/frontend/lib/cms";
import { categoryFaqs, categoryMetaDescription, CATEGORY_SEO } from "@/frontend/lib/category-seo";
import { TOPIC_SEO, topicProducts } from "@/frontend/lib/topic-seo";
import { pageMetadata } from "@/frontend/lib/seo";

type Params = { topic: string };

async function load(slug: string) {
  // Own property only: "constructor" in a URL must not resolve to a topic.
  const topic = Object.hasOwn(TOPIC_SEO, slug) ? TOPIC_SEO[slug] : undefined;
  if (!topic) return null;
  const products = topicProducts(topic, await getAllProducts());
  return products.length ? { topic, products } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { topic: slug } = await params;
  const found = await load(slug);
  // 404 here so the response carries a real 404 status: see shop/p/[slug].
  if (!found) notFound();
  return pageMetadata({
    title: found.topic.title,
    description: categoryMetaDescription(found.topic, found.products),
    path: `/shop/t/${slug}`,
    keywords: found.topic.keywords,
  });
}

export default async function TopicPage({ params }: { params: Promise<Params> }) {
  const { topic: slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { topic, products } = found;
  const parent = await getCategoryBySlug(topic.parent);
  const faqs = categoryFaqs(topic, products);
  const trail = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    ...(parent ? [{ name: parent.name, path: `/shop/c/${parent.slug}` }] : []),
    { name: topic.h1, path: `/shop/t/${slug}` },
  ];
  const links = topic.related.flatMap((r) =>
    Object.hasOwn(CATEGORY_SEO, r) ? [{ href: `/shop/c/${r}`, name: CATEGORY_SEO[r].h1 }] : [],
  );

  return (
    <Container className="py-8">
      <JsonLd data={breadcrumbJsonLd(trail)} />
      <JsonLd data={itemListJsonLd(topic.h1, products.map((p) => ({ name: p.name, path: `/shop/p/${p.slug}` })))} />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Shop", href: "/shop" },
          ...(parent ? [{ name: parent.name, href: `/shop/c/${parent.slug}` }] : []),
          { name: topic.h1 },
        ]}
      />

      <div className="mt-4">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{topic.h1}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{topic.intro}</p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p, i) => (
          <CatalogProductCard key={p.slug} product={p} priority={i < 4} />
        ))}
      </div>

      <CategoryGuide seo={topic} faqs={faqs} links={links} products={products} />
    </Container>
  );
}
