"use client";

import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    // Re-keyed by count so the pop animation replays on every change (+1 feedback).
    <span
      key={count}
      className="animate-badge-pop absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function CartButton() {
  const { cartCount, openCartDrawer } = useStore();
  return (
    <button
      type="button"
      onClick={openCartDrawer}
      aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
      aria-haspopup="dialog"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:bg-muted hover:border-foreground/20 active:scale-95"
    >
      <ShoppingCart className="h-[18px] w-[18px]" />
      <Badge count={cartCount} />
    </button>
  );
}

export function WishlistBadgeButton() {
  const { wishlistCount } = useStore();
  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist, ${wishlistCount} item${wishlistCount === 1 ? "" : "s"}`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-all hover:bg-muted hover:border-foreground/20 active:scale-95"
    >
      <Heart className="h-[18px] w-[18px]" />
      <Badge count={wishlistCount} />
    </Link>
  );
}
