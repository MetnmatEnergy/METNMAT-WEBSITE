import type { Metadata } from "next";
import { Container } from "@/frontend/components/ui/container";
import { SearchBar } from "@/frontend/components/commerce/search-bar";
import { SortSelect } from "@/frontend/components/commerce/sort-select";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { searchProducts, getFeaturedProducts } from "@/frontend/lib/cms";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the METNMAT catalog.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? await searchProducts(query) : await getFeaturedProducts(8);

  return (
    <Container className="py-8">
      <div className="max-w-2xl">
        <SearchBar />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h1 className="font-display text-xl font-bold">
          {query ? (
            <>
              {results.length} result{results.length === 1 ? "" : "s"} for{" "}
              <span className="text-brand">&ldquo;{query}&rdquo;</span>
            </>
          ) : (
            "Browse the catalog"
          )}
        </h1>
        <SortSelect />
      </div>

      {results.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">
            No products matched <span className="text-foreground">&ldquo;{query}&rdquo;</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different term, or request a quote for a custom requirement.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((p) => (
            <CatalogProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </Container>
  );
}
