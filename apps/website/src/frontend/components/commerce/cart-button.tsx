"use client";

import Link from "next/link";
import { ShoppingCart, Heart } from "lucide-react";
import { useStore } from "@/frontend/components/commerce/store-provider";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function CartButton() {
  const { cartCount } = useStore();
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted"
    >
      <ShoppingCart className="h-[18px] w-[18px]" />
      <Badge count={cartCount} />
    </Link>
  );
}

export function WishlistBadgeButton() {
  const { wishlistCount } = useStore();
  return (
    <Link
      href="/wishlist"
      aria-label={`Wishlist, ${wishlistCount} item${wishlistCount === 1 ? "" : "s"}`}
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted"
    >
      <Heart className="h-[18px] w-[18px]" />
      <Badge count={wishlistCount} />
    </Link>
  );
}
