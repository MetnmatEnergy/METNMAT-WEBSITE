"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { inclGST, usdFor, lineUsdValue } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

const COLLAPSE_KEY = "mm-rail-collapsed";

/**
 * Amazon-style persistent cart rail — a slim fixed column on the right edge
 * (desktop only) that appears as soon as the cart has items: subtotal +
 * "Go to Cart" on top, then each item with its image, GST-inclusive price and
 * a quantity stepper (trash icon at minimum quantity, like Amazon).
 * Collapsible to a small pill (remembered across visits). Hidden on /cart and
 * /checkout where the full cart UI already exists.
 */
export function CartRail() {
  const { cartLines, cartCount, setQty, removeFromCart } = useStore();
  const { money, currency, usdRate } = useCurrency();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const hiddenRoute = pathname.startsWith("/cart") || pathname.startsWith("/checkout");
  const visible = cartCount > 0 && !hiddenRoute;

  const subtotalIncl = cartLines.reduce((n, l) => n + inclGST(l.unitPrice) * l.qty, 0);
  const usdSubtotal =
    currency === "USD"
      ? cartLines.reduce((n, l) => n + lineUsdValue(l.product, l.unitPrice, l.qty, usdRate), 0)
      : undefined;

  if (!visible) return null;

  // Collapsed: slim pill that re-opens the rail.
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={`Show cart panel (${cartCount} items, ${money(subtotalIncl, usdSubtotal)})`}
        className={cn(
          "fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 lg:flex",
          "flex-col items-center gap-1.5 rounded-l-2xl border border-r-0 border-border",
          "bg-surface/95 px-2.5 py-4 shadow-xl backdrop-blur transition-colors hover:border-brand/40"
        )}
      >
        <span className="relative">
          <ShoppingCart className="h-5 w-5 text-brand" />
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        </span>
        <span className="text-[10px] font-bold tabular-nums [writing-mode:vertical-rl]">
          {money(subtotalIncl, usdSubtotal)}
        </span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Shopping cart summary"
      className={cn(
        "fixed bottom-28 right-3 top-32 z-30 hidden w-44 flex-col overflow-hidden",
        "rounded-2xl border border-border bg-surface/95 shadow-xl backdrop-blur",
        "animate-fade-up lg:flex"
      )}
    >
      {/* Subtotal + Go to Cart */}
      <div className="relative border-b border-border p-3 text-center">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Hide cart panel"
          title="Hide cart panel"
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <p className="text-xs text-muted-foreground">Subtotal · incl. GST</p>
        <p className="mt-0.5 font-display text-base font-bold tabular-nums text-brand">
          {money(subtotalIncl, usdSubtotal)}
        </p>
        <Link
          href="/cart"
          className="mt-2 block w-full rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:border-brand/50 hover:text-brand"
        >
          Go to Cart{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {cartLines.map((line) => {
          const min = Math.max(1, line.product.moq || 1);
          const atMin = line.qty <= min;
          return (
            <div key={line.slug} className="animate-fade-up text-center">
              <Link
                href={`/shop/p/${line.slug}`}
                title={line.product.name}
                className="block overflow-hidden rounded-xl border border-border bg-white"
              >
                {line.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.product.imageUrl}
                    alt={line.product.name}
                    loading="lazy"
                    className="mx-auto h-20 w-full object-contain p-1.5 transition-transform duration-200 hover:scale-105"
                  />
                ) : (
                  <span className="flex h-20 items-center justify-center font-display text-2xl font-bold text-zinc-300">
                    M
                  </span>
                )}
              </Link>
              <p className="mt-1.5 text-xs font-semibold tabular-nums">
                {line.product.price
                  ? money(inclGST(line.unitPrice) * line.qty, usdFor(line.product, inclGST(line.unitPrice) * line.qty))
                  : "On request"}
              </p>

              {/* Quantity stepper (Amazon-style pill) */}
              <div className="mt-1.5 flex items-center justify-between rounded-full border border-border bg-background px-1.5 py-1">
                <button
                  type="button"
                  aria-label={atMin ? `Remove ${line.product.name} from cart` : "Decrease quantity"}
                  onClick={() =>
                    atMin ? removeFromCart(line.slug) : setQty(line.slug, line.qty - 1)
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-brand"
                >
                  {atMin ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                </button>
                <span className="text-xs font-bold tabular-nums" aria-live="polite">
                  {line.qty}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty(line.slug, line.qty + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-brand"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
