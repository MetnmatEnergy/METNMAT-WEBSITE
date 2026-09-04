import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { ProductImage } from "@/frontend/components/commerce/product-image";
import { Button } from "@/frontend/components/ui/button";
import { PriceBlock } from "@/frontend/components/commerce/price-block";
import { RatingStars } from "@/frontend/components/commerce/rating-stars";
import { AddToCartButton } from "@/frontend/components/commerce/add-to-cart-button";
import { RequestQuoteButton } from "@/frontend/components/commerce/request-quote-button";
import { WishlistButton } from "@/frontend/components/commerce/wishlist-button";
import { availabilityLabel, isQuoteOnly, type Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

/** Commerce product card — Amazon/Flipkart style. Supports grid + list layout. */
export function CatalogProductCard({
  product,
  layout = "grid",
  priority = false,
}: {
  product: Product;
  layout?: "grid" | "list";
  /**
   * Preload this card's photo. ProductImage has supported it all along; nothing
   * passed it, so every card on the catalogue — including the first row, which
   * is the largest thing above the fold and therefore the LCP element on the
   * main browse path — waited for the lazy-loading observer.
   *
   * Set it only for the cards that are actually above the fold. Preloading the
   * whole grid would trade one slow image for twelve competing ones.
   */
  priority?: boolean;
}) {
  const href = `/shop/p/${product.slug}`;
  const isGrid = layout === "grid";

  return (
    <div
      className={cn(
        "group relative flex rounded-2xl border border-border bg-surface transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg",
        isGrid ? "flex-col" : "flex-col sm:flex-row"
      )}
    >
      <div className="absolute right-2.5 top-2.5 z-10">
        <WishlistButton product={product} />
      </div>

      <Link
        href={href}
        // A catalogue grid renders ~20 cards with TWO links each, and Next
        // prefetches every visible Link on sight — so arriving at /shop fired
        // dozens of speculative RSC requests, most of them aborted as the
        // visitor scrolled past. Intent, not sight: prefetch={false} keeps the
        // hover prefetch, which is the one that actually predicts a click.
        // Same reasoning as the cart icon in cart-button.tsx.
        prefetch={false}
        // The link carries the name and the image is decorative (alt=""). The
        // alternative — naming both — makes the accessible name duplicate the
        // image's alt and fails WCAG 2.5.3; dropping the aria-label instead
        // left the link with NO name at all when the product has no photo,
        // which is worse. One name, on the link.
        aria-label={product.name}

        className={cn(
          "block shrink-0 overflow-hidden",
          isGrid ? "rounded-t-2xl" : "rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none",
          !isGrid && "sm:w-56"
        )}
      >
        <ProductImage
          src={product.imageUrl}
          srcSet={product.imageSrcSet}
          priority={priority}
          alt=""
          // Most of the catalogue has no photo yet, so this placeholder is what
          // a shopper actually sees. Naming it after the product (rather than
          // the generic "Product") means the visible word matches the link's
          // accessible name — a voice user saying what they can read reaches
          // the right card (WCAG 2.5.3) — and it reads better besides.
          label={product.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
          className={cn(
            "w-full bg-white",
            isGrid ? "rounded-t-2xl" : "sm:rounded-l-2xl",
            !product.imageUrl && "rounded-none border-0"
          )}
          imageClassName="p-2 transition-transform duration-500 group-hover:scale-105 sm:p-3"
        />
      </Link>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {product.badges && product.badges.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.badges.slice(0, 2).map((b) => (
              <span
                key={b}
                className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-soft"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {product.brand && (
          <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </span>
        )}
        <Link
          href={href}
          prefetch={false}
          className={cn(
            "mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug hover:text-brand sm:text-base",
            // Reserve two lines in grid so price/MOQ rows align across cards.
            isGrid && "min-h-[2.6rem] sm:min-h-[2.75rem]"
          )}
        >
          {product.name}
        </Link>

        {layout === "list" && product.shortDesc && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.shortDesc}</p>
        )}

        {product.rating > 0 && <RatingStars rating={product.rating} className="mt-2" />}

        <div className="mt-2.5">
          <PriceBlock product={product} size="sm" />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            MOQ: {product.moq} {product.unit}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1",
              product.inStock ? "text-emerald-700 dark:text-emerald-400" : "text-amber-500"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                product.inStock ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
            {availabilityLabel(product)}
          </span>
        </div>

        {/* Actions — pinned to the bottom (mt-auto) so the cart/quote bar lines
            up across all cards in a row. Stacked & full-width in grid (tidy at
            2-up mobile), inline on the wider list layout. All ≥44px for taps. */}
        <div className={cn("mt-auto gap-2 pt-4", isGrid ? "grid" : "flex flex-col sm:flex-row sm:items-center")}>
          {isQuoteOnly(product) ? (
            // Quote-only items can't be bought online — promote the RFQ flow.
            <RequestQuoteButton
              product={{ name: product.name, slug: product.slug, sku: product.sku }}
              label="Request a quote"
              variant="brand"
              withIcon
              className={cn("h-11 justify-center", isGrid ? "w-full" : "sm:flex-1")}
            />
          ) : product.sizes && product.sizes.length > 0 ? (
            // Variable product (multiple sizes) — pick options on the product page.
            <>
              <Button href={href} size="md" className={cn("gap-2", isGrid && "w-full")}>
                <SlidersHorizontal className="h-4 w-4" /> Select options
              </Button>
              <RequestQuoteButton
                product={{ name: product.name, slug: product.slug, sku: product.sku }}
                label="Request a quote"
                className={cn("h-11", isGrid && "w-full")}
              />
            </>
          ) : (
            <>
              <AddToCartButton product={product} size="md" fullWidth={isGrid} />
              <RequestQuoteButton
                product={{ name: product.name, slug: product.slug, sku: product.sku }}
                label="Request a quote"
                className={cn("h-11", isGrid && "w-full")}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
