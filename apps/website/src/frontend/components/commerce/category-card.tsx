import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { Category } from "@/frontend/lib/catalog";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/shop/c/${category.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-brand/40"
    >
      <MediaPlaceholder className="aspect-[5/3] rounded-none border-0" label={category.name} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold">{category.name}</h3>
        {category.blurb && (
          <p className="mt-1 flex-1 text-sm text-muted-foreground">{category.blurb}</p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground/90 group-hover:text-brand">
          Browse <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
