import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { GlowCard } from "@/frontend/components/ui/spotlight-card";
import type { Category } from "@/frontend/lib/catalog";

export function CategoryCard({ category }: { category: Category }) {
  return (
    <Link href={`/shop/c/${category.slug}`} className="group block h-full">
      <GlowCard
        glowColor="brand"
        className="flex h-full flex-col gap-3 p-3 transition-transform duration-300 group-hover:-translate-y-0.5"
      >
        {category.imageUrl ? (
          <span className="relative block aspect-[5/3] overflow-hidden rounded-xl bg-white">
            <Image
              src={category.imageUrl}
              alt={category.name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </span>
        ) : (
          <MediaPlaceholder className="aspect-[5/3] rounded-xl border-0" label={category.name} />
        )}
        <div className="flex flex-1 flex-col">
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
      </GlowCard>
    </Link>
  );
}
