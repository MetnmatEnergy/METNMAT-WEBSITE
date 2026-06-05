"use client";

import Link from "next/link";
import { Trash2, ArrowRight, FileText, ShoppingCart } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { MediaPlaceholder } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { QuantityStepper } from "@/frontend/components/commerce/quantity-stepper";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { formatINR } from "@/frontend/lib/catalog";

export default function CartPage() {
  const { cartLines, cartSubtotal, setQty, removeFromCart, clearCart, cartCount } = useStore();

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
              <Link href={`/shop/p/${line.slug}`} className="shrink-0">
                <MediaPlaceholder className="h-24 w-24" label="" />
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
                  <button
                    onClick={() => removeFromCart(line.slug)}
                    aria-label="Remove"
                    className="h-fit text-muted-foreground hover:text-brand"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatINR(line.unitPrice)} / {line.product.unit}
                </p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <QuantityStepper
                    value={line.qty}
                    min={line.product.moq}
                    onChange={(v) => setQty(line.slug, v)}
                  />
                  <span className="font-semibold">
                    {line.product.price ? formatINR(line.lineTotal) : "On request"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          <div className="flex justify-between p-4">
            <button onClick={clearCart} className="text-sm text-muted-foreground hover:text-brand">
              Clear cart
            </button>
            <Link href="/shop" className="text-sm font-medium hover:text-brand">
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
                <dt className="text-muted-foreground">Subtotal (excl. GST)</dt>
                <dd className="font-medium">{formatINR(cartSubtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">GST &amp; shipping</dt>
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
              GST invoice · Razorpay / Stripe · India &amp; worldwide shipping
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
