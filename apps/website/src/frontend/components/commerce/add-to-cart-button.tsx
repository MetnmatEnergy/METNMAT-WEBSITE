"use client";

import * as React from "react";
import { ShoppingCart, Check } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import { Button } from "@/frontend/components/ui/button";
import type { Product } from "@/frontend/lib/catalog";
import { cn } from "@/frontend/lib/utils";

export function AddToCartButton({
  product,
  qty = 1,
  className,
  size = "md",
}: {
  product: Product;
  qty?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const { addToCart } = useStore();
  const [added, setAdded] = React.useState(false);

  function handle() {
    addToCart(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Button type="button" size={size} onClick={handle} className={cn(className)}>
      {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
      {added ? "Added" : "Add to cart"}
    </Button>
  );
}
