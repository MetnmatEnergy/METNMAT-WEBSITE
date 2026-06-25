import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/frontend/components/ui/container";
import { JsonLd, breadcrumbJsonLd } from "@/frontend/components/seo/json-ld";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { FilterSidebar } from "@/frontend/components/commerce/filter-sidebar";
import { FilterDrawer } from "@/frontend/components/commerce/filter-drawer";
import { SortSelect } from "@/frontend/components/commerce/sort-select";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { Pagination } from "@/frontend/components/commerce/pagination";
import { getAllProducts, getAllCategories } from "@/frontend/lib/cms";
import { parseShopQuery, shopFacets, applyShopQuery, hasActiveFilters } from "@/frontend/lib/shop-query";
import { pageMetadata } from "@/frontend/lib/seo";

type Search = Record<string, string | string[] | undefined>;

export const metadata: Metadata = pageMetadata({
  title: "All Products — Shop the Full Catalog",
  description:
    "Browse the complete METNMAT catalog — electrodes, ion-exchange membranes, electrochemical cells & reactors, lab equipment and accessories. Filter by brand, price and availability. GST invoice, pan-India & worldwide shipping.",
  path: "/shop/all",
});

export default async function AllProductsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [all, allCategories] = await Promise.all([getAllProducts(), getAllCategories()]);

  const query = parseShopQuery(sp);
  const facets = shopFacets(all);
  const { items, total, totalPages, page } = applyShopQuery(all, query);
  const filtersActive = hasActiveFilters(query);
  const sidebarProps = {
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
          { name: "All products", path: "/shop/all" },
        ])}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Shop", href: "/shop" },
          { name: "All products" },
        ]}
      />

      <div className="mt-4">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">All products</h1>
        <p className="mt-1 text-muted-foreground">
          The full catalog — filter by brand, price &amp; availability.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">
          <FilterSidebar {...sidebarProps} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <FilterDrawer {...sidebarProps} />
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? "product" : "products"}
              </p>
            </div>
            <SortSelect />
          </div>

          {all.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">No products in the catalog yet.</p>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">No products match your filters.</p>
              {filtersActive && (
                <Link href="/shop/all" className="mt-2 inline-block text-sm text-brand hover:underline">
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
