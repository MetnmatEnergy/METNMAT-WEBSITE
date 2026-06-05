"use client";

import { Heart } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { useStore } from "@/frontend/components/commerce/store-provider";

export default function WishlistPage() {
  const { wishlist } = useStore();
  const items = wishlist;

  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
        Your wishlist
      </h1>

      {items.length === 0 ? (
        <div className="mx-auto max-w-md py-16 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface">
            <Heart className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="mt-5 text-muted-foreground">
            You haven&apos;t saved any products yet. Tap the heart on any product.
          </p>
          <Button href="/shop" className="mt-6">Go to shop</Button>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <CatalogProductCard key={p.slug} product={p} />
          ))}
        </div>
      )}
    </Container>
  );
}
