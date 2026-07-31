"use client";

import { Heart } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import type { Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

export function WishlistButton({
  product,
  className,
  withLabel = false,
}: {
  product: Product;
  className?: string;
  withLabel?: boolean;
}) {
  const { inWishlist, toggleWishlist } = useStore();
  const active = inWishlist(product.slug);

  return (
    <button
      type="button"
      onClick={() => toggleWishlist(product)}
      aria-pressed={active}
      // Must contain the visible word ("Save"/"Saved") — WCAG 2.5.3 Label in
      // Name. "Add to wishlist" beside a button reading "Save" meant a voice
      // user saying "click Save" could not activate it.
      aria-label={active ? "Saved — remove from wishlist" : "Save to wishlist"}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 text-sm transition-colors hover:bg-surface",
        withLabel ? "px-4 py-2" : "h-9 w-9 justify-center",
        className
      )}
    >
      <Heart className={cn("h-4 w-4", active && "fill-brand text-brand")} />
      {withLabel && (active ? "Saved" : "Save")}
    </button>
  );
}
