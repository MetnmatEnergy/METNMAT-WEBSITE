import Link from "next/link";
import type { Category, Product } from "@/frontend/lib/catalog";

/**
 * Every product as a plain link, grouped by category. The grid above shows one
 * page of the catalogue at a time, so most products sat three or four clicks from
 * the home page. This puts each one two clicks away, for buyers scanning the
 * range and for crawlers alike.
 */
export function ProductIndex({ products, categories }: { products: Product[]; categories: Category[] }) {
  const groups = categories
    .map((c) => ({ category: c, items: products.filter((p) => p.categorySlug === c.slug && !p.noIndex) }))
    .filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="product-index" className="mt-16 border-t border-border pt-8">
      <h2 id="product-index" className="font-display text-xl font-bold tracking-tight">
        Every product, by category
      </h2>
      <div className="mt-6 gap-8 sm:columns-2 lg:columns-3">
        {groups.map(({ category, items }) => (
          <div key={category.slug} className="mb-6 break-inside-avoid">
            <Link href={`/shop/c/${category.slug}`} className="font-display text-sm font-semibold hover:text-brand">
              {category.name}
            </Link>
            <ul className="mt-1.5 space-y-1">
              {items.map((p) => (
                <li key={p.slug}>
                  <Link href={`/shop/p/${p.slug}`} className="text-sm text-muted-foreground hover:text-foreground">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
