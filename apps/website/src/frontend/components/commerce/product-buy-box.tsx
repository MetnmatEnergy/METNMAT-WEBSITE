"use client";

import * as React from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { QuantityStepper } from "@/frontend/components/commerce/quantity-stepper";
import { PlusOne } from "@/frontend/components/commerce/add-to-cart-button";
import { WishlistButton } from "@/frontend/components/commerce/wishlist-button";
import { RequestQuoteButton } from "@/frontend/components/commerce/request-quote-button";
import { Button } from "@/frontend/components/ui/button";
import { inclGST, unitPriceForQty, usdFor, isQuoteOnly, type Product } from "@/frontend/lib/catalog";
import { useCurrency } from "@/frontend/components/commerce/currency-provider";
import { cn } from "@/frontend/lib/utils";

export function ProductBuyBox({ product }: { product: Product }) {
  const { addToCart } = useStore();
  const { money } = useCurrency();
  const [qty, setQty] = React.useState(product.moq);
  const [size, setSize] = React.useState<string>(product.sizes?.[0] ?? "");
  const [added, setAdded] = React.useState(false);
  const [plusTrigger, setPlusTrigger] = React.useState(0);

  const hasSizes = !!(product.sizes && product.sizes.length > 0);
  // The quote ref carries the chosen size into the customization drawer.
  const quoteRef = {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    ...(hasSizes && size ? { size } : {}),
  };

  const stock = (
    <p className={`mt-1 text-sm ${product.inStock ? "text-emerald-500" : "text-amber-500"}`}>
      {product.inStock ? "In stock" : "Made to order"} · {product.leadTime}
    </p>
  );

  const sizePicker = hasSizes ? (
    <div className="mt-4">
      <p className="text-sm font-medium text-muted-foreground">
        Size{product.sizes!.length > 1 ? <span className="ml-1 text-xs">· choose one</span> : null}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Size">
        {product.sizes!.map((s) => {
          const active = size === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSize(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-colors",
                active
                  ? "border-brand bg-brand/10 font-semibold text-brand-soft"
                  : "border-border text-foreground/80 hover:border-brand/40 hover:text-foreground"
              )}
            >
              {active && <Check className="h-3.5 w-3.5" />}
              {s}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  // ── Quote-only (no online price): no cart, promote the RFQ flow. ──────────────
  if (isQuoteOnly(product)) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-bold">Price on request</span>
          <span className="text-xs text-muted-foreground">/ {product.unit}</span>
        </div>
        {stock}
        {sizePicker}
        <p className="mt-3 text-sm text-muted-foreground">
          This is a made-to-order / bulk item. Share your quantity and specs and we&apos;ll
          send a GST quote.
        </p>
        <div className="mt-4 grid gap-2">
          <RequestQuoteButton product={quoteRef} label="Request a quote" variant="brand" withIcon className="w-full py-2.5" />
          <WishlistButton product={product} withLabel className="w-full justify-center" />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          GST invoice · Pan-India &amp; worldwide shipping · Datasheet on request
        </p>
      </div>
    );
  }

  // Display GST-inclusive prices (catalog stores base prices excl. GST).
  const unit = inclGST(unitPriceForQty(product, qty));
  const total = unit * qty;
  const hasDiscount = !!product.mrp && product.mrp > product.price;
  const mrpIncl = hasDiscount ? inclGST(product.mrp!) : 0;
  const off = hasDiscount ? Math.round((1 - product.price / product.mrp!) * 100) : 0;

  function handleAdd() {
    addToCart(product, qty, hasSizes ? size || undefined : undefined);
    setAdded(true);
    setPlusTrigger((t) => t + 1);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-2xl font-bold">{money(unit, usdFor(product, unit))}</span>
        <span className="text-xs text-muted-foreground">/ {product.unit} · incl. GST</span>
      </div>
      {hasDiscount && (
        <p className="mt-0.5 text-sm">
          <span className="text-muted-foreground line-through">
            {money(mrpIncl, usdFor(product, mrpIncl))}
          </span>{" "}
          <span className="font-semibold text-emerald-500">{off}% off</span>
        </p>
      )}

      {stock}
      {sizePicker}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          Qty <span className="text-xs">(MOQ {product.moq})</span>
        </span>
        <QuantityStepper value={qty} min={product.moq} onChange={setQty} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-semibold">{money(total, usdFor(product, total))}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <span className="relative">
          <PlusOne trigger={plusTrigger} qty={qty} />
          <Button
            type="button"
            onClick={handleAdd}
            className={`w-full ${added ? "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-600" : ""}`}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {added ? "Added to cart" : "Add to cart"}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {added ? `Added ${qty} × ${product.name}${hasSizes && size ? ` (${size})` : ""} to cart` : ""}
          </span>
        </span>
        <RequestQuoteButton product={quoteRef} variant="outline" withIcon className="w-full" />
        <WishlistButton product={product} withLabel className="w-full justify-center" />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        GST invoice · Secure checkout · Datasheet on request
      </p>
    </div>
  );
}
