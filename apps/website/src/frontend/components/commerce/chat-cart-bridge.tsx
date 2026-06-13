"use client";

import * as React from "react";
import { useStore } from "@/frontend/components/commerce/store-provider";
import type { Product } from "@/frontend/lib/catalog";

/**
 * Bridge between the chatbot widget and the shop cart.
 *
 * The chat's "Add to cart" button posts ADD_TO_CART to the widget loader, which
 * dispatches a `metnmat:add-to-cart` event on this window with the product SKU.
 * We resolve the product via the same-origin /api/product-by-sku route, add it
 * to the cart (respecting MOQ), and answer with `metnmat:cart-result` so the
 * chat can confirm to the customer. Renders nothing.
 */
export function ChatCartBridge() {
  const { addToCart } = useStore();

  React.useEffect(() => {
    const respond = (detail: { ok: boolean; sku: string; name?: string; error?: string }) => {
      window.dispatchEvent(new CustomEvent("metnmat:cart-result", { detail }));
    };

    const onAdd = async (event: Event) => {
      const { sku, qty } = ((event as CustomEvent).detail ?? {}) as { sku?: string; qty?: number };
      if (!sku) return;
      try {
        const res = await fetch(`/api/product-by-sku?sku=${encodeURIComponent(sku)}`);
        if (!res.ok) {
          respond({ ok: false, sku, error: "product not found" });
          return;
        }
        const { product } = (await res.json()) as { product: Product };
        const quantity = Math.max(1, qty ?? product.moq ?? 1);
        addToCart(product, quantity);
        respond({ ok: true, sku, name: product.name });
      } catch {
        respond({ ok: false, sku, error: "network error" });
      }
    };

    window.addEventListener("metnmat:add-to-cart", onAdd);
    return () => window.removeEventListener("metnmat:add-to-cart", onAdd);
  }, [addToCart]);

  return null;
}
