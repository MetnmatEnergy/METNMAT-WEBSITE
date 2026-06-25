import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { FilterSidebar } from "@/frontend/components/commerce/filter-sidebar";
import { FilterDrawer } from "@/frontend/components/commerce/filter-drawer";
import { SortSelect } from "@/frontend/components/commerce/sort-select";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { Pagination } from "@/frontend/components/commerce/pagination";
import {
  getCategoryBySlug,
  getProductsByCategory,
  getSubCategories,
  getAllCategories,
} from "@/frontend/lib/cms";
import { parseShopQuery, shopFacets, applyShopQuery, hasActiveFilters } from "@/frontend/lib/shop-query";

type Params = { category: string };
type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  return {
    title: cat ? `${cat.name} — Shop` : "Category",
    description: cat?.blurb,
    alternates: { canonical: `/shop/c/${category}` },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { category } = await params;
  const sp = await searchParams;
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();

  const [all, subs, allCategories] = await Promise.all([
    getProductsByCategory(category),
    getSubCategories(category),
    getAllCategories(),
  ]);
  const parent = cat.parent ? await getCategoryBySlug(cat.parent) : null;

  const query = parseShopQuery(sp);
  const facets = shopFacets(all);
  const { items, total, totalPages, page } = applyShopQuery(all, query);
  const filtersActive = hasActiveFilters(query);
  const sidebarProps = {
    activeCategory: parent?.slug ?? cat.slug,
    categories: allCategories,
    brands: facets.brands,
    priceMin: facets.priceMin,
    priceMax: facets.priceMax,
  };

  return (
    <Container className="py-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          ...(parent ? [{ name: parent.name, path: `/shop/c/${parent.slug}` }] : []),
          { name: cat.name, path: `/shop/c/${cat.slug}` },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Shop", href: "/shop" },
          ...(parent ? [{ name: parent.name, href: `/shop/c/${parent.slug}` }] : []),
          { name: cat.name },
        ]}
      />

      <div className="mt-4">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {cat.name}
        </h1>
        {cat.blurb && <p className="mt-1 text-muted-foreground">{cat.blurb}</p>}
      </div>

      {/* Subcategory chips */}
      {subs.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {subs.map((s) => (
            <Link
              key={s.slug}
              href={`/shop/c/${s.slug}`}
              className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted-foreground hover:border-brand/40 hover:text-foreground"
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">
          <FilterSidebar {...sidebarProps} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <FilterDrawer {...sidebarProps} />
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? "result" : "results"}
              </p>
            </div>
            <SortSelect />
          </div>

          {all.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              No products in this category yet.
            </p>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">No products match your filters.</p>
              {filtersActive && (
                <Link
                  href={`/shop/c/${category}`}
                  className="mt-2 inline-block text-sm text-brand hover:underline"
                >
                  Clear filters
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => (
                  <CatalogProductCard key={p.slug} product={p} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="mt-10">
                  <Pagination current={page} total={totalPages} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
