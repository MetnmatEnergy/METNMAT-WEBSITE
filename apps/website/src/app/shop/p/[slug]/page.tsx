import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { Truck, BadgeCheck, FileText, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { RatingStars } from "@/frontend/components/commerce/rating-stars";
import { PriceTiers } from "@/frontend/components/commerce/price-block";
import { ProductBuyBox } from "@/frontend/components/commerce/product-buy-box";
import { ProductGallery } from "@/frontend/components/commerce/product-gallery";
import { ProductTabs } from "@/frontend/components/commerce/product-tabs";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { JsonLd } from "@/frontend/components/seo/json-ld";
import {
  getProductBySlug,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/frontend/lib/cms";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product ? `${product.name} — ${product.brand}` : "Product",
    description: product?.shortDesc,
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const category = await getCategoryBySlug(product.categorySlug);
  const parent = category?.parent ? await getCategoryBySlug(category.parent) : null;
  const related = (await getProductsByCategory(product.categorySlug))
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);

  return (
    <Container className="py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          sku: product.sku,
          brand: { "@type": "Brand", name: product.brand },
          description: product.shortDesc,
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }}
      />

      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Shop", href: "/shop" },
          ...(parent ? [{ name: parent.name, href: `/shop/c/${parent.slug}` }] : []),
          ...(category ? [{ name: category.name, href: `/shop/c/${category.slug}` }] : []),
          { name: product.name },
        ]}
      />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_1fr_320px]">
        {/* Gallery (CMS images, click-to-zoom) */}
        <ProductGallery images={product.images ?? []} name={product.name} />

        {/* Summary */}
        <div>
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <RatingStars rating={product.rating} count={product.reviewCount} />
            <span className="text-sm text-muted-foreground">SKU: {product.sku}</span>
          </div>

          <p className="mt-4 text-muted-foreground">{product.shortDesc}</p>

          {product.badges && product.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.badges.map((b) => (
                <span key={b} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-soft">
                  {b}
                </span>
              ))}
            </div>
          )}

          {/* Key specs */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold">Key specifications</h2>
            <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
              {product.specs.map((s, i) => (
                <div key={i} className="flex justify-between py-2.5">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Bulk pricing */}
          <div className="mt-6">
            <PriceTiers product={product} />
          </div>
        </div>

        {/* Buy box */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductBuyBox product={product} />
        </div>
      </div>

      {/* Trust badges */}
      <div className="mt-10 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-surface/40 p-4 text-sm sm:grid-cols-4">
        {[
          { icon: Truck, label: "India & worldwide shipping" },
          { icon: BadgeCheck, label: "ISO-aligned R&D" },
          { icon: FileText, label: "GST invoice" },
          { icon: ShieldCheck, label: "Secure checkout" },
        ].map((t) => (
          <span key={t.label} className="flex items-center gap-2 text-muted-foreground">
            <t.icon className="h-4 w-4 text-brand" /> {t.label}
          </span>
        ))}
      </div>

      {/* Tabbed product details */}
      <div className="mt-10">
        <ProductTabs product={product} />
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold">Related products</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <CatalogProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
