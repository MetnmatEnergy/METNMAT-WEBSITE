"use client";

import * as React from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { Button } from "@/frontend/components/ui/button";
import type { Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

/**
 * Floating "+N" chip that rises from the Add-to-cart button on each click —
 * the marketplace-style confirmation. Re-keyed by `trigger` so rapid clicks
 * replay the animation. Decorative only (the button label + cart badge carry
 * the accessible state).
 */
export function PlusOne({ trigger, qty = 1 }: { trigger: number; qty?: number }) {
  if (!trigger) return null;
  return (
    <span
      key={trigger}
      aria-hidden
      className="animate-float-plus pointer-events-none absolute -top-2 left-1/2 z-10 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shadow-lg"
    >
      +{qty}
    </span>
  );
}

export function AddToCartButton({
  product,
  qty = 1,
  className,
  size = "md",
  fullWidth = false,
}: {
  product: Product;
  qty?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}) {
  const { addToCart } = useStore();
  const [added, setAdded] = React.useState(false);
  const [plusTrigger, setPlusTrigger] = React.useState(0);

  function handle() {
    addToCart(product, qty);
    setAdded(true);
    setPlusTrigger((t) => t + 1);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <span className={cn("relative inline-flex", fullWidth && "w-full")}>
      <PlusOne trigger={plusTrigger} qty={qty} />
      <Button
        type="button"
        size={size}
        onClick={handle}
        className={cn(
          fullWidth && "w-full",
          added && "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-600",
          className
        )}
      >
        {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
        {added ? "Added to cart" : "Add to cart"}
      </Button>
    </span>
  );
}
