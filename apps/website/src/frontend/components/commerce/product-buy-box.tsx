"use client";

import * as React from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { QuantityStepper } from "@/frontend/components/commerce/quantity-stepper";
import { WishlistButton } from "@/frontend/components/commerce/wishlist-button";
import { RequestQuoteButton } from "@/frontend/components/commerce/request-quote-button";
import { Button } from "@/frontend/components/ui/button";
import { formatINR, unitPriceForQty, type Product } from "@/frontend/lib/catalog";

export function ProductBuyBox({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const [qty, setQty] = React.useState(product.moq);
  const [added, setAdded] = React.useState(false);

  const unit = unitPriceForQty(product, qty);
  const total = unit * qty;

  function handleAdd() {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl font-bold">{formatINR(unit)}</span>
        <span className="text-xs text-muted-foreground">/ {product.unit} · excl. GST</span>
      </div>

      <p className="mt-1 text-sm text-emerald-500">
        {product.inStock ? "In stock" : "Made to order"} · {product.leadTime}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Qty <span className="text-xs">(MOQ {product.moq})</span>
        </span>
        <QuantityStepper value={qty} min={product.moq} onChange={setQty} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-semibold">{product.price ? formatINR(total) : "On request"}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <Button type="button" onClick={handleAdd} className="w-full">
          {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          {added ? "Added to cart" : "Add to cart"}
        </Button>
        <RequestQuoteButton
          product={{ name: product.name, slug: product.slug, sku: product.sku }}
          variant="outline"
          withIcon
          className="w-full"
        />
        <WishlistButton product={product} withLabel className="w-full justify-center" />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        GST invoice · Secure checkout · Datasheet on request
      </p>
    </div>
  );
}
