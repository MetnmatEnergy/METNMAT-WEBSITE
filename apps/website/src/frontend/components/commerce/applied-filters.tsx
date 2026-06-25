"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useShopTransition } from "@/frontend/components/commerce/shop-transition";

/**
 * Amazon-style "applied filters" row above the results — each active brand, the
 * price range and the in-stock toggle render as a removable pill, plus a
 * "Clear all". Filter state is read from the URL and removed through the shared
 * navigation transition, so removing a chip dims the results like any other
 * change. Renders nothing when no narrowing filter is active.
 */
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

type Chip = { key: string; label: string; remove: (params: URLSearchParams) => void };

export function AppliedFilters() {
  const searchParams = useSearchParams();
  const { navigate } = useShopTransition();

  const brands = (searchParams.get("brand") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const inStock = searchParams.get("stock") === "1";
  const min = searchParams.get("min");
  const max = searchParams.get("max");

  const chips: Chip[] = [];

  for (const b of brands) {
    chips.push({
      key: `brand:${b}`,
      label: b,
      remove: (p) => {
        const next = brands.filter((x) => x !== b);
        if (next.length) p.set("brand", next.join(","));
        else p.delete("brand");
      },
    });
  }

  if (min || max) {
    const label =
      min && max
        ? `${inr(Number(min))} – ${inr(Number(max))}`
        : min
          ? `From ${inr(Number(min))}`
          : `Up to ${inr(Number(max))}`;
    chips.push({
      key: "price",
      label,
      remove: (p) => {
        p.delete("min");
        p.delete("max");
      },
    });
  }

  if (inStock) {
    chips.push({ key: "stock", label: "In stock only", remove: (p) => p.delete("stock") });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Filters:</span>
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => navigate(c.remove)}
          aria-label={`Remove filter: ${c.label}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-3 pr-2 text-xs font-medium transition-colors hover:border-brand/40 hover:text-brand"
        >
          {c.label}
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() =>
            navigate((p) => {
              p.delete("brand");
              p.delete("min");
              p.delete("max");
              p.delete("stock");
            })
          }
          className="ml-1 text-xs font-medium text-brand hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
