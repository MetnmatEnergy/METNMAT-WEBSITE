import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { Truck, BadgeCheck, FileText, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { PriceTiers } from "@/frontend/components/commerce/price-block";
import { ProductBuyBox } from "@/frontend/components/commerce/product-buy-box";
import { ProductGallery } from "@/frontend/components/commerce/product-gallery";
import { ProductTabs } from "@/frontend/components/commerce/product-tabs";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { inclGST, isQuoteOnly } from "@/frontend/lib/catalog";
import { site } from "@/frontend/lib/site";
import { AnalyticsEntity } from "@/frontend/lib/analytics/entity";
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
  if (!product) {
    return { title: "Product", alternates: { canonical: `/shop/p/${slug}` } };
  }
  const title = product.brand ? `${product.name} — ${product.brand}` : product.name;
  return {
    title,
    description: product.shortDesc,
    alternates: { canonical: `/shop/p/${slug}` },
    openGraph: {
      type: "website",
      title,
      description: product.shortDesc,
      url: `${site.url}/shop/p/${slug}`,
      ...(product.imageUrl ? { images: [{ url: product.imageUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.shortDesc,
      ...(product.imageUrl ? { images: [product.imageUrl] } : {}),
    },
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
      <AnalyticsEntity type="product" slug={product.slug} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          // Emit optional fields only when present — the CMS mapper defaults
          // brand/sku/shortDesc to "", and shipping empty Brand/description/sku
          // nodes is invalid structured data that search engines flag.
          ...(product.sku ? { sku: product.sku, mpn: product.sku } : {}),
          ...(category?.name ? { category: category.name } : {}),
          ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
          ...(product.shortDesc ? { description: product.shortDesc } : {}),
          ...(product.imageUrl ? { image: product.imageUrl } : {}),
          // Surface the technical specs already rendered on the page as
          // machine-readable properties (rich results + AI grounding).
          ...(product.specs && product.specs.length > 0
            ? { additionalProperty: product.specs.filter((s) => s.label && s.value).map((s) => ({ "@type": "PropertyValue", name: s.label, value: s.value })) }
            : {}),
          // Only emit a buyable Offer for genuinely purchasable items. A
          // quote-only/discontinued product shows "Price on request" on the
          // page, so advertising a concrete price + InStock in structured data
          // would mislead SERP rich results. Availability tracks productType.
          ...(!isQuoteOnly(product) && product.price
            ? {
                offers: {
                  "@type": "Offer",
                  priceCurrency: "INR",
                  price: inclGST(product.price),
                  // (Discontinued/quote-only items never reach here — isQuoteOnly
                  // gates the whole Offer block off — so it's just in/out of stock.)
                  availability: product.inStock
                    ? "https://schema.org/InStock"
                    : "https://schema.org/OutOfStock",
                  itemCondition: "https://schema.org/NewCondition",
                  url: `${site.url}/shop/p/${product.slug}`,
                  seller: { "@type": "Organization", "@id": `${site.url}/#organization`, name: site.legalName },
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          ...(parent ? [{ name: parent.name, path: `/shop/c/${parent.slug}` }] : []),
          ...(category ? [{ name: category.name, path: `/shop/c/${category.slug}` }] : []),
          { name: product.name, path: `/shop/p/${product.slug}` },
        ])}
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

      {/* Two-frame layout: gallery (left) + all details & actions (right). */}
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Left frame: gallery (CMS images, click-to-zoom) + key specs at a glance */}
        <div className="self-start">
          <ProductGallery images={product.images ?? []} name={product.name} videoUrl={product.videoUrl} />

          {product.specs.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold">Key specifications</h2>
              <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
                {product.specs.slice(0, 6).map((s, i) => (
                  <div key={i} className="flex justify-between gap-6 py-2.5">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="text-right font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
              {product.specs.length > 6 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Full details in the <span className="font-semibold text-foreground/80">Specifications</span> tab below.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right frame: brand, title, price, buy actions, description, specs */}
        <div>
          <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">SKU: {product.sku}</span>
          </div>

          {product.badges && product.badges.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {product.badges.map((b) => (
                <span key={b} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-soft">
                  {b}
                </span>
              ))}
            </div>
          )}

          {/* Price + quantity + Add to cart / Request for Customization + wishlist */}
          <div className="mt-5">
            <ProductBuyBox product={product} />
          </div>

          {/* Description */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold">Description</h2>
            <p className="mt-2 text-muted-foreground">{product.shortDesc}</p>
          </div>

          {/* Bulk pricing */}
          <div className="mt-6">
            <PriceTiers product={product} />
          </div>
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
