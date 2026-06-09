import Link from "next/link";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { PriceBlock } from "@/frontend/components/commerce/price-block";
import { AddToCartButton } from "@/frontend/components/commerce/add-to-cart-button";
import { RequestQuoteButton } from "@/frontend/components/commerce/request-quote-button";
import { WishlistButton } from "@/frontend/components/commerce/wishlist-button";
import type { Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

/** Commerce product card — Amazon/Flipkart style. Supports grid + list layout. */
export function CatalogProductCard({
  product,
  layout = "grid",
}: {
  product: Product;
  layout?: "grid" | "list";
}) {
  const href = `/shop/p/${product.slug}`;

  return (
    <div
      className={cn(
        "group relative flex rounded-2xl border border-border bg-surface transition-colors hover:border-brand/40",
        layout === "grid" ? "flex-col" : "flex-col sm:flex-row"
      )}
    >
      <div className="absolute right-3 top-3 z-10">
        <WishlistButton product={product} />
      </div>

      <Link href={href} className={cn("block shrink-0", layout === "list" && "sm:w-56")}>
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className={cn(
              "w-full bg-white object-contain",
              layout === "grid"
                ? "aspect-square rounded-t-2xl"
                : "aspect-square sm:h-full sm:rounded-l-2xl"
            )}
          />
        ) : (
          <MediaPlaceholder
            className={cn(
              "rounded-none border-0",
              layout === "grid"
                ? "aspect-square rounded-t-2xl"
                : "aspect-square sm:h-full sm:rounded-l-2xl"
            )}
            label="Product"
          />
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {product.badges && product.badges.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.badges.map((b) => (
              <span
                key={b}
                className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-soft"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {product.brand}
        </span>
        <Link href={href} className="mt-0.5 font-display text-base font-semibold hover:text-brand">
          {product.name}
        </Link>

        {layout === "list" && (
          <p className="mt-2 text-sm text-muted-foreground">{product.shortDesc}</p>
        )}

        <div className="mt-3">
          <PriceBlock product={product} size="sm" />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            MOQ: {product.moq} {product.unit}
          </span>
          <span className={product.inStock ? "text-emerald-500" : "text-muted-foreground"}>
            {product.inStock ? "In stock" : "Made to order"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <AddToCartButton product={product} size="sm" />
          <RequestQuoteButton product={{ name: product.name, slug: product.slug, sku: product.sku }} />
        </div>
      </div>
    </div>
  );
}
