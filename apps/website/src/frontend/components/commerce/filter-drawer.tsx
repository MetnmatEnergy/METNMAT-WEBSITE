"use client";

import * as React from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Category } from "@/frontend/lib/catalog";
import { FilterSidebar } from "@/frontend/components/commerce/filter-sidebar";
import { useDialog } from "@/frontend/components/ui/use-dialog";

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
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);

  // It already declared role="dialog" aria-modal="true" while doing no focus
  // management at all, which is the combination that misleads a screen-reader
  // user most: announced as modal, but Tab walks straight out into the page
  // behind it.
  useDialog({ open, onClose: close, containerRef: dialogRef });

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
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 outline-none lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <div className="absolute inset-0 bg-black/50" onClick={close} />
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
