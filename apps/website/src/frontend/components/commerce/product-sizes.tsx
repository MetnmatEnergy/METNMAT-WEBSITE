"use client";

import * as React from "react";
import { Ruler, FileText, Check } from "lucide-react";
import { useQuote } from "@/frontend/components/commerce/quote-provider";
import { cn } from "@/frontend/lib/utils";

/**
 * "Available sizes" picker for a product (one SKU offered in several sizes).
 * Selecting a size and requesting a quote opens the customization drawer with
 * the product + chosen size pre-filled.
 */
export function ProductSizes({
  product,
  sizes,
}: {
  product: { name: string; slug: string; sku?: string };
  sizes: string[];
}) {
  const { openQuote } = useQuote();
  const [selected, setSelected] = React.useState(sizes[0] ?? "");
  if (!sizes || sizes.length === 0) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface/40 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Ruler className="h-4 w-4 text-brand" />
        Available sizes
        <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {sizes.length}
        </span>
      </h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {sizes.map((s) => {
          const active = selected === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
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

      <button
        type="button"
        onClick={() => openQuote({ ...product, size: selected })}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
      >
        <FileText className="h-4 w-4" />
        Request a quote{selected ? ` — ${selected}` : ""}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Pick a size, then request a quote — we&apos;ll confirm price &amp; lead time.
      </p>
    </div>
  );
}
