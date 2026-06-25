"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { useStore } from "@/frontend/components/commerce/store-provider";
import type { Product } from "@/frontend/lib/catalog";

/**
 * "Buy again" — rebuilds the cart from a past order. Slugs are resolved to the
 * CURRENT catalog (today's price/stock), so removed or now-quote-only items are
 * skipped with an honest message rather than silently dropped.
 */
export function ReorderButton({
  items,
  className,
}: {
  items: { slug?: string; qty?: number }[];
  className?: string;
}) {
  const router = useRouter();
  const { addToCart } = useStore();
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const slugs = Array.from(new Set(items.map((i) => i.slug).filter(Boolean))) as string[];

  async function reorder() {
    if (!slugs.length) {
      setMsg("These items can't be reordered.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/products/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs }),
      });
      const data = (await res.json()) as { products?: Product[] };
      const bySlug = new Map((data.products ?? []).map((p) => [p.slug, p]));

      let added = 0;
      for (const it of items) {
        const p = it.slug ? bySlug.get(it.slug) : undefined;
        if (p && p.price) {
          addToCart(p, it.qty || p.moq || 1); // addToCart clamps to MOQ/cap
          added += 1;
        }
      }

      if (added === 0) {
        setMsg("Sorry — these items aren't available to buy online anymore.");
        setLoading(false);
        return;
      }
      // Any removed / now-quote-only items are simply left out; the cart shows
      // exactly what could be re-added at today's prices.
      router.push("/cart");
    } catch {
      setMsg("Couldn't reorder right now. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button type="button" variant="outline" onClick={reorder} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
        {loading ? "Adding to cart…" : "Buy again"}
      </Button>
      {msg && (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
