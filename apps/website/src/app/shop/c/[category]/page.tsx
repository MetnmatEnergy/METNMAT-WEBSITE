import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/frontend/components/ui/container";
import { Breadcrumbs } from "@/frontend/components/commerce/breadcrumbs";
import { FilterSidebar } from "@/frontend/components/commerce/filter-sidebar";
import { SortSelect } from "@/frontend/components/commerce/sort-select";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { Pagination } from "@/frontend/components/commerce/pagination";
import {
  getCategoryBySlug,
  getProductsByCategory,
  getSubCategories,
  getAllCategories,
} from "@/frontend/lib/cms";

type Params = { category: string };

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
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { category } = await params;
  const cat = await getCategoryBySlug(category);
  if (!cat) notFound();

  const [items, subs, allCategories] = await Promise.all([
    getProductsByCategory(category),
    getSubCategories(category),
    getAllCategories(),
  ]);
  const parent = cat.parent ? await getCategoryBySlug(cat.parent) : null;

  return (
    <Container className="py-8">
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
          <FilterSidebar activeCategory={parent?.slug ?? cat.slug} categories={allCategories} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
            <p className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "result" : "results"}
            </p>
            <SortSelect />
          </div>

          {items.length === 0 ? (
            <p className="py-16 text-center text-muted-foreground">
              No products in this category yet.
            </p>
          ) : (
            <>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => (
                  <CatalogProductCard key={p.slug} product={p} />
                ))}
              </div>
              <div className="mt-10">
                <Pagination current={1} total={1} />
              </div>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
