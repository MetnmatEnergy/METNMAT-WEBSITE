"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useShopTransition } from "@/frontend/components/commerce/shop-transition";
import { cn } from "@/frontend/lib/utils";

/**
 * Wraps the product grid so it dims with a spinner while a filter/sort change is
 * in flight, and announces the result count to screen readers whenever it
 * changes (the count is server-rendered, so a re-render updates the live region).
 */
export function ResultsRegion({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const { isPending } = useShopTransition();
  return (
    <div className="relative">
      <p aria-live="polite" aria-atomic className="sr-only">
        {count} {count === 1 ? "product" : "products"} found
      </p>
      <div
        aria-busy={isPending}
        className={cn(
          "transition-opacity duration-200",
          isPending && "pointer-events-none select-none opacity-40"
        )}
      >
        {children}
      </div>
      {isPending && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-24">
          <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden />
        </div>
      )}
    </div>
  );
}
