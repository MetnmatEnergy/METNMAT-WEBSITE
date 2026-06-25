"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { inclGST, usdFor, lineUsdValue } from "@/frontend/lib/catalog";

/**
 * Quick-cart drawer — a slide-in panel opened from the header cart icon. This is
 * the cart review/adjust surface on mobile & tablet (where the desktop rail is
 * hidden), and a fast popover on desktop. Closes on backdrop click, Escape and
 * route change; locks body scroll and traps focus while open.
 */
export function CartDrawer() {
  const { cartLines, cartCount, setQty, removeFromCart, cartDrawerOpen, closeCartDrawer } = useStore();
  const { money, currency, usdRate } = useCurrency();
  const pathname = usePathname();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  // Close on navigation.
  React.useEffect(() => {
    closeCartDrawer();
  }, [pathname, closeCartDrawer]);

  // Escape + focus trap + scroll lock while open.
  React.useEffect(() => {
    if (!cartDrawerOpen) return;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeCartDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const f = panelRef.current?.querySelectorAll<HTMLElement>(
        'button,a[href],input,[tabindex]:not([tabindex="-1"])'
      );
      if (!f || f.length === 0) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      const a = document.activeElement;
      if (e.shiftKey && a === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && a === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [cartDrawerOpen, closeCartDrawer]);

  if (!cartDrawerOpen) return null;

  const subtotalIncl = cartLines.reduce((n, l) => n + inclGST(l.unitPrice) * l.qty, 0);
  const usdSubtotal =
    currency === "USD"
      ? cartLines.reduce((n, l) => n + lineUsdValue(l.product, l.unitPrice, l.qty, usdRate), 0)
      : undefined;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div className="absolute inset-0 bg-black/50" onClick={closeCartDrawer} />
      <div
        ref={panelRef}
        className="absolute right-0 top-0 flex h-full w-full max-w-sm animate-slide-in-right flex-col bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ShoppingCart className="h-5 w-5 text-brand" /> Your cart
            {cartCount > 0 && <span className="text-sm font-normal text-muted-foreground">({cartCount})</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeCartDrawer}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {cartCount === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link href="/shop" onClick={closeCartDrawer} className="text-sm font-medium text-brand hover:underline">
              Browse the shop →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 divide-y divide-border overflow-y-auto">
              {cartLines.map((line) => {
                const min = Math.max(1, line.product.moq || 1);
                const atMin = line.qty <= min;
                return (
                  <div key={line.key} className="flex gap-3 p-4">
                    <Link
                      href={`/shop/p/${line.slug}`}
                      onClick={closeCartDrawer}
                      className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-white"
                    >
                      {line.product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.product.imageUrl} alt={line.product.name} loading="lazy" className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="flex h-full items-center justify-center font-display text-xl font-bold text-zinc-300">M</span>
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/shop/p/${line.slug}`}
                        onClick={closeCartDrawer}
                        className="line-clamp-2 text-sm font-medium hover:text-brand"
                      >
                        {line.product.name}
                      </Link>
                      {line.size && <p className="text-xs text-muted-foreground">Size: {line.size}</p>}
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {line.product.price
                          ? money(inclGST(line.unitPrice) * line.qty, usdFor(line.product, inclGST(line.unitPrice) * line.qty))
                          : "On request"}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-full border border-border">
                          <button
                            type="button"
                            aria-label={atMin ? `Remove ${line.product.name}` : "Decrease quantity"}
                            onClick={() => (atMin ? removeFromCart(line.key) : setQty(line.key, line.qty - 1))}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-brand"
                          >
                            {atMin ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          </button>
                          <span className="min-w-7 text-center text-sm font-bold tabular-nums">{line.qty}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => setQty(line.key, line.qty + 1)}
                            className="flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors hover:text-brand"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.key)}
                          aria-label={`Remove ${line.product.name} from cart`}
                          className="ml-auto text-muted-foreground transition-colors hover:text-brand"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (incl. GST)</span>
                <span className="font-semibold tabular-nums">{money(subtotalIncl, usdSubtotal)}</span>
              </div>
              <div className="mt-3 grid gap-2">
                <Link
                  href="/checkout"
                  onClick={closeCartDrawer}
                  className="flex items-center justify-center rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
                >
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  onClick={closeCartDrawer}
                  className="flex items-center justify-center rounded-full border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-brand/40 hover:text-brand"
                >
                  View full cart
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
