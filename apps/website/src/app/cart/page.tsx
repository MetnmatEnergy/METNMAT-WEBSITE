"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2, ArrowRight, FileText, ShoppingCart, Loader2, Heart } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { QuantityStepper } from "@/frontend/components/commerce/quantity-stepper";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { inclGST, usdFor, lineUsdValue, type Product } from "@/frontend/lib/catalog";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";

export default function CartPage() {
  const { cartLines, setQty, removeFromCart, clearCart, cartCount, ready, toggleWishlist, inWishlist } = useStore();
  const { money, currency, usdRate } = useCurrency();
  const [confirmClear, setConfirmClear] = React.useState(false);

  // "Save for later": keep the product on the wishlist, then drop it from the
  // cart (the existing remove-undo toast still fires, so a misclick is recoverable).
  function moveToWishlist(slug: string, product: Product) {
    if (!inWishlist(slug)) toggleWishlist(product);
    removeFromCart(slug);
  }
  // Display GST-inclusive totals (catalog stores base prices excl. GST).
  const subtotalIncl = cartLines.reduce((n, l) => n + inclGST(l.unitPrice) * l.qty, 0);
  // For USD visitors, honor any staff-set USD price (base unit) so totals match the PDP.
  const usdSubtotal =
    currency === "USD"
      ? cartLines.reduce((n, l) => n + lineUsdValue(l.product, l.unitPrice, l.qty, usdRate), 0)
      : undefined;

  // Avoid a false "empty cart" flash before localStorage hydrates.
  if (!ready) {
    return (
      <Container className="py-16 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </Container>
    );
  }

  if (cartCount === 0) {
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface">
            <ShoppingCart className="h-7 w-7 text-muted-foreground" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold">Your cart is empty</h1>
          <p className="mt-2 text-muted-foreground">
            Browse the catalog and add products, or request a bulk quote.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button href="/shop">Go to shop</Button>
            <Button href="/quote" variant="outline">Request a quote</Button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Shopping cart
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Lines */}
        <div className="divide-y divide-border rounded-2xl border border-border">
          {cartLines.map((line) => (
            <div key={line.slug} className="flex gap-4 p-4">
              <Link
                href={`/shop/p/${line.slug}`}
                className="block h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-white"
              >
                {line.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.product.imageUrl}
                    alt={line.product.name}
                    loading="lazy"
                    className="h-full w-full object-contain p-1.5"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center font-display text-3xl font-bold text-zinc-300">
                    M
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {line.product.brand}
                    </span>
                    <Link href={`/shop/p/${line.slug}`} className="block font-medium hover:text-brand">
                      {line.product.name}
                    </Link>
                  </div>
                  <div className="flex h-fit items-center gap-3">
                    <button
                      onClick={() => moveToWishlist(line.slug, line.product)}
                      aria-label="Save for later"
                      title="Save for later"
                      className="text-muted-foreground hover:text-brand"
                    >
                      <Heart className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeFromCart(line.slug)}
                      aria-label="Remove"
                      className="text-muted-foreground hover:text-brand"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {money(inclGST(line.unitPrice), usdFor(line.product, inclGST(line.unitPrice)))} / {line.product.unit} · incl. GST
                </p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QuantityStepper
                    value={line.qty}
                    min={line.product.moq}
                    onChange={(v) => setQty(line.slug, v)}
                  />
                  <span className="font-semibold">
                    {line.product.price
                      ? money(inclGST(line.unitPrice) * line.qty, usdFor(line.product, inclGST(line.unitPrice) * line.qty))
                      : "On request"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 p-4">
            {confirmClear ? (
              <span className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Clear entire cart?</span>
                <button
                  onClick={() => { clearCart(); setConfirmClear(false); }}
                  className="font-medium text-brand hover:underline"
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-sm text-muted-foreground hover:text-brand"
              >
                Clear cart
              </button>
            )}
            <Link href="/shop" className="shrink-0 text-sm font-medium hover:text-brand">
              Continue shopping →
            </Link>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-lg font-semibold">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal (incl. GST)</dt>
                <dd className="font-semibold">{money(subtotalIncl, usdSubtotal)}</dd>
              </div>
              <p className="text-xs text-muted-foreground">Includes GST</p>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="text-muted-foreground">Calculated at checkout</dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-2">
              <Button href="/checkout" className="w-full">
                Proceed to checkout <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/quote" variant="outline" className="w-full">
                <FileText className="h-4 w-4" /> Request quote for these items
              </Button>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              GST invoice · Secured by Razorpay · India &amp; worldwide shipping
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
