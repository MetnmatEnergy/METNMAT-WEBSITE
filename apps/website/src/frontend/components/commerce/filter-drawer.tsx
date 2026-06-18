"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Category } from "@/frontend/lib/catalog";
import { FilterSidebar } from "@/frontend/components/commerce/filter-sidebar";

/**
 * Mobile/tablet access to the filter rail — a "Filters" button (hidden on lg+)
 * that opens the FilterSidebar in a slide-over with scroll-lock + Escape close.
 */
export function FilterDrawer(props: {
  activeCategory?: string;
  categories?: Category[];
  brands?: string[];
  priceMin?: number;
  priceMax?: number;
}) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-brand/40 lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" /> Filters
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-display text-base font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <FilterSidebar {...props} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
