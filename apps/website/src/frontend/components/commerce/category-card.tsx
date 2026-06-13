import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import type { Category } from "@/frontend/lib/catalog";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={`/shop/c/${category.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
    >
      {category.imageUrl ? (
        <span className="block aspect-[5/3] overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={category.imageUrl}
            alt={category.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </span>
      ) : (
        <MediaPlaceholder className="aspect-[5/3] rounded-none border-0" label={category.name} />
      )}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug group-hover:text-brand sm:text-base">
          {category.name}
        </h3>
        {category.blurb && (
          <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted-foreground sm:text-sm">
            {category.blurb}
          </p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground/90 group-hover:text-brand">
          Browse <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
