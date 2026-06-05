import Link from "next/link";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { Product } from "@/frontend/lib/placeholder";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-brand/40"
    >
      <MediaPlaceholder className="aspect-[4/3] rounded-none border-0" label="Product" />
      <div className="flex flex-1 flex-col p-5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-soft">
          {product.category}
        </span>
        <h3 className="mt-1 font-display text-lg font-semibold">{product.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{product.blurb}</p>
        <span className="mt-4 text-sm font-medium text-foreground/90 group-hover:text-brand">
          View details →
        </span>
      </div>
    </Link>
  );
}
