import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, LayoutGrid, FlaskConical, Newspaper, FolderGit2 } from "lucide-react";
import type { SiteLinkType } from "@/frontend/lib/cms";
import { Container } from "@/frontend/components/ui/container";
import { SearchBar } from "@/frontend/components/commerce/search-bar";
import { SortSelect } from "@/frontend/components/commerce/sort-select";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { Pagination } from "@/frontend/components/commerce/pagination";
import { searchSite, searchProducts, getFeaturedProducts } from "@/frontend/lib/cms";
import { sortProducts, PAGE_SIZE } from "@/frontend/lib/shop-query";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the whole METNMAT site — products, categories and pages.",
  // Query-result pages are thin, infinite-permutation, per-visitor views — keep
  // them out of the index (still follow, so crawlers reach real product/content
  // pages). robots.ts also Disallows /search; this is the belt-and-braces meta,
  // since a URL can be indexed from inbound links even when crawling is blocked.
  robots: { index: false, follow: true },
  alternates: { canonical: "/search" },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; scope?: string; sort?: string; page?: string }>;
}) {
  const { q = "", scope, sort = "relevance", page } = await searchParams;
  const query = q.trim();
  const productsOnly = scope === "products";

  const { products: rawProducts, links } = query
    ? productsOnly
      ? { products: await searchProducts(query), links: [] }
      : await searchSite(query)
    : { products: await getFeaturedProducts(8), links: [] };
  const products = sortProducts(rawProducts, sort);
  const total = products.length + links.length;

  // Paginate the product results (the site links show on page 1 only).
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, parseInt(page || "1", 10) || 1), totalPages);
  const pageProducts = products.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const LINK_ICON: Record<SiteLinkType, typeof FileText> = {
    Service: FlaskConical,
    Blog: Newspaper,
    Project: FolderGit2,
    Category: LayoutGrid,
    Page: FileText,
  };

  return (
    <Container className="py-8">
      <div className="max-w-2xl">
        <SearchBar
          scope={productsOnly ? "products" : "all"}
          placeholder={productsOnly ? "Search products…" : "Search the whole site…"}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="font-display text-xl font-bold">
          {query ? (
            <>
              {total} result{total === 1 ? "" : "s"} for{" "}
              <span className="text-brand">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            "Browse the catalog"
          )}
        </h1>
        {products.length > 0 && <SortSelect />}
      </div>

      {/* Pages & categories */}
      {links.length > 0 && current === 1 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Across the site
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => {
              const Icon = LINK_ICON[l.type];
              return (
              <li key={`${l.type}-${l.href}`}>
                <Link
                  href={l.href}
                  className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-brand/40"
                >
                  <span className="mt-0.5 text-muted-foreground group-hover:text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold">{l.title}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {l.type}
                      </span>
                    </span>
                    {l.desc && (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {l.desc}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                </Link>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Products */}
      {products.length > 0 && (
        <div className="mt-8">
          {links.length > 0 && current === 1 && (
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Products</h2>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageProducts.map((p) => (
              <CatalogProductCard key={p.slug} product={p} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination current={current} total={totalPages} />
            </div>
          )}
        </div>
      )}

      {query && total === 0 && (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">
            Nothing matched <span className="text-foreground">&ldquo;{query}&rdquo;</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different term, or{" "}
            <Link href="/quote" className="text-brand hover:underline">
              request a customization
            </Link>{" "}
            for a custom requirement.
          </p>
        </div>
      )}
    </Container>
  );
}
