import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { Truck, BadgeCheck, FileText, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { PriceTiers } from "@/frontend/components/commerce/price-block";
import { ProductBuyBox } from "@/frontend/components/commerce/product-buy-box";
import { ProductGallery } from "@/frontend/components/commerce/product-gallery";
import { ProductTabs } from "@/frontend/components/commerce/product-tabs";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { JsonLd, breadcrumbJsonLd, organizationJsonLd, productJsonLd, productFaqs, faqJsonLd } from "@/frontend/components/seo/json-ld";
import { productMetaDescription } from "@/frontend/lib/seo";
import { inclGST, isQuoteOnly, type Product } from "@/frontend/lib/catalog";
import { site } from "@/frontend/lib/site";
import { AnalyticsEntity } from "@/frontend/lib/analytics/entity";
import {
  getProductBySlug,
  getCategoryBySlug,
  resolveProductSlugRedirect,
  getProductsByCategory,
  getProductSitemapEntries,
  mapCmsProduct,
} from "@/frontend/lib/cms";
import { getDraftProductRaw } from "@/backend/services/catalog.service";

/**
 * Makes the route ISR-cacheable. A dynamic segment needs either
 * generateStaticParams or an explicit revalidate to be cached at all; this had
 * neither, so Next rendered every product view fully dynamically and served
 * `private, no-cache, no-store`. The catalogue's busiest pages got no CDN or
 * browser caching whatsoever and re-fetched the CMS on every single hit.
 *
 * 60s matches the `api()` data cache, so nothing becomes staler than it already
 * was — the rendered HTML simply becomes cacheable too. Price and stock
 * accuracy does not depend on this window: every Product save fires
 * revalidateWebsiteAfterChange -> revalidateTag("cms"), which purges
 * immediately. The window is only the fallback if that webhook fails.
 */
export const revalidate = 60;

/**
 * Required for the route to be cacheable at all. `revalidate` on its own does
 * nothing here: without knowing the params at build time Next never puts a
 * dynamic segment on the ISR path, so it rendered every view fully dynamically
 * (verified — adding revalidate alone left the header at `no-store`).
 *
 * A cold CMS during a Cloud Build degrades this to an empty list, which is
 * exactly today's behaviour, so a build-time fetch failure costs nothing.
 * dynamicParams stays default (true), so a product added after the build is
 * still served on demand and then cached.
 */
export async function generateStaticParams(): Promise<Params[]> {
  const products = await getProductSitemapEntries().catch(() => []);
  return products.map((p) => ({ slug: p.slug }));
}

type Params = { slug: string };

/**
 * Draft preview. When the CMS Preview button has turned draft mode on
 * (/api/shop/preview), read the product's LATEST DRAFT through the server-side
 * internal key instead of the public API — which only ever returns published
 * documents, and therefore 404'd for exactly the products staff wanted to
 * preview. Mirrors the blog's loadArticle().
 *
 * Draft mode does not disturb normal traffic: `draftMode()` inside a prerender
 * returns a disabled instance without marking the route dynamic, and a request
 * that DOES carry the bypass cookie skips the ISR cache entirely (verified in
 * next@15.1.6 base-server.js:1321 — `if (!isPreviewMode && isSSG …)` is what
 * assigns the cache key — and dist/server/request/draft-mode.js).
 */
async function loadProduct(slug: string): Promise<{ product: Product | null; preview: boolean }> {
  const { isEnabled } = await draftMode();
  if (isEnabled) {
    const raw = await getDraftProductRaw(slug);
    if (raw) return { product: mapCmsProduct(raw), preview: true };
  }
  return { product: await getProductBySlug(slug), preview: false };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  // A never-published product has no public version, so the fetch above is empty
  // and the notFound() below would fire before the page body ever ran. Draft
  // mode is only on when a signed preview link set it. noindex regardless, so a
  // leaked preview URL can never be indexed. (Same escape hatch as the blog.)
  if (!product && (await draftMode()).isEnabled) {
    return { title: "Draft preview", robots: { index: false } };
  }
  // Renamed product? 301 the old indexed URL to the current one. This sits
  // BELOW the draft-mode escape hatch above deliberately — a signed preview of a
  // draft whose slug changed must render the preview, not get redirected away.
  //
  // The lookup is inside this branch, so a product that resolves — the common
  // case, every real page view — never queries the redirect collection at all.
  // Same placement as /blog/[slug] (blog/[slug]/page.tsx:51-53).
  if (!product) {
    const target = await resolveProductSlugRedirect(slug);
    if (target) permanentRedirect(`/shop/p/${target}`);
  }
  // 404 HERE, not just in the page body. generateMetadata runs before the
  // response starts, so this is the only place that can still set a 404 STATUS
  // — returning placeholder metadata instead produced a soft-404: the 404 page
  // rendered but the response was HTTP 200, so search engines indexed every
  // bogus /shop/p/* URL as a real page. (Same pattern the blog already uses.)
  if (!product) notFound();
  // CMS overrides win; each falls back to what the page derived before, so a
  // product with the SEO tab untouched renders byte-identical metadata.
  //
  // The brand suffix is only appended for a THIRD-PARTY brand. Appending it
  // unconditionally double-branded every own-brand product, because the root
  // title template (app/layout.tsx) already appends " · METNMAT": the SERP title
  // read "…Working Electrode (3 mm) — METNMAT · METNMAT", burning ~10 characters
  // of a ~60-character budget on a repeat of the same word. Branding is the
  // template's job; the page title's job is the product.
  const brand = product.brand?.trim();
  const ownBrand = brand?.toLowerCase() === site.name.toLowerCase();
  const title = product.seoTitle || (brand && !ownBrand ? `${product.name} — ${brand}` : product.name);
  // Derived per SKU rather than `metaDescription || shortDesc`: shortDesc is
  // written per product FAMILY, so that fallback repeated one description across
  // up to three different SKUs. See productMetaDescription().
  const description = productMetaDescription(product);
  const image = product.ogImageUrl || product.imageUrl;
  return {
    title,
    description,
    ...(product.seoKeywords ? { keywords: product.seoKeywords.split(",").map((k) => k.trim()).filter(Boolean) } : {}),
    // noIndex keeps the page reachable on the site but out of the index — the
    // usual reason is a product that is listed for existing customers only.
    ...(product.noIndex ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: product.canonicalUrl || `/shop/p/${slug}` },
    openGraph: {
      type: "website",
      // Branded explicitly: Next's root title template applies to `title` only,
      // never to openGraph/twitter. Every other route brands its OG title via
      // pageMetadata() as "<page> · METNMAT"; this one was shipping bare, so a
      // shared product link showed no company name at all once the redundant
      // "— METNMAT" suffix above was removed.
      title: `${title} · ${site.name}`,
      siteName: site.legalName,
      description,
      url: `${site.url}/shop/p/${slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${site.name}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const { product, preview } = await loadProduct(slug);
  if (!product) {
    // Reached only when generateMetadata took the draft-mode escape hatch and
    // returned metadata instead of throwing. Mirrors blog/[slug]/page.tsx:89-93.
    const target = await resolveProductSlugRedirect(slug);
    if (target) permanentRedirect(`/shop/p/${target}`);
    notFound();
  }

  const category = await getCategoryBySlug(product.categorySlug);
  const parent = category?.parent ? await getCategoryBySlug(category.parent) : null;
  const related = (await getProductsByCategory(product.categorySlug))
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4);
  const faqs = productFaqs(product);

  return (
    <Container className="py-8">
      {preview && (
        <div className="mb-6 rounded-md bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-foreground">
          Draft preview — this version is not public. Close this tab and use the CMS to publish.
        </div>
      )}
      {/* A staff preview is not customer traffic: never record it. */}
      {!preview && <AnalyticsEntity type="product" slug={product.slug} />}
      {/* The Offer below names its seller by reference ({@id: #organization}).
          Without the full node on this page that reference dangles, so the
          seller resolves to a bare name. Emitting it here makes it resolvable;
          it dedupes by @id, same as on /, /about, /contact and /services. */}
      <JsonLd data={organizationJsonLd} />
      <JsonLd
        data={productJsonLd({
          product,
          categoryName: category?.name,
          priceInclGst: product.price ? inclGST(product.price) : undefined,
          offerable: !isQuoteOnly(product),
          related: related.map((p) => ({ slug: p.slug, name: p.name })),
        })}
      />
      {faqs.length > 0 && <JsonLd data={faqJsonLd(faqs)} />}
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
          <ProductGallery
            images={product.images ?? []}
            fulls={product.imageFulls}
            fullSrcSets={product.imageFullSrcSets}
            srcSets={product.imageSrcSets}
            alts={product.imageAlts}
            name={product.name}
            videoUrl={product.videoUrl}
          />

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

      {/* Buyer questions. Rendered as real page content, not schema-only —
          Google requires FAQ answers to be visible on the page, and an answer a
          customer can't read is no use to them either. Every entry is derived
          from a field set on THIS product or from a published policy page. */}
      {faqs.length > 0 && (
        <section className="mt-14" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="font-display text-xl font-bold">
            Questions about this product
          </h2>
          <dl className="mt-6 divide-y divide-border border-y border-border">
            {faqs.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

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
