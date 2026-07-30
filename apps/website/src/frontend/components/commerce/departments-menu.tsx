"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGrid, ChevronDown } from "lucide-react";
import type { Category } from "@/frontend/lib/catalog";

/** "All Categories" mega-menu (Amazon/Flipkart style). Categories come live
 *  from the CMS (passed by the server-rendered header). */
export function DepartmentsMenu({ categories = [] }: { categories?: Category[] }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  /**
   * Close when the customer's attention moves elsewhere.
   *
   * This deliberately does NOT use a click-catching overlay (the old approach):
   * an invisible full-screen div closes the menu but eats the click, so tapping
   * a product card only dismissed the menu and you had to click a second time.
   * Instead we listen on the capture phase and never preventDefault — the menu
   * closes AND the click lands on whatever you actually clicked.
   *
   * `rootRef` wraps the trigger as well as the panel, so a click on the trigger
   * isn't treated as "outside" (which would close then immediately reopen).
   */
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus(); // keyboard users land back on the trigger
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const topCategories = categories.filter((c) => !c.parent);
  const subCategories = (parent: string) => categories.filter((c) => c.parent === parent);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="departments-menu"
        className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        <LayoutGrid className="h-4 w-4" />
        Categories
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div
            id="departments-menu"
            // max-h + scroll: with 10 departments and their sub-categories this
            // list is taller than a 768px laptop viewport, and an absolutely
            // positioned panel would otherwise run off the bottom of the screen.
            className="absolute left-0 top-full z-40 mt-2 max-h-[calc(100vh-9rem)] w-[560px] max-w-[90vw] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-xl"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {topCategories.map((c) => (
                <div key={c.slug}>
                  <Link
                    href={`/shop/c/${c.slug}`}
                    onClick={() => setOpen(false)}
                    className="font-display text-sm font-semibold hover:text-brand"
                  >
                    {c.name}
                  </Link>
                  <ul className="mt-1.5 space-y-1">
                    {subCategories(c.slug).map((s) => (
                      <li key={s.slug}>
                        <Link
                          href={`/shop/c/${s.slug}`}
                          onClick={() => setOpen(false)}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              className="mt-4 block border-t border-border pt-3 text-sm font-medium text-brand"
            >
              Visit the full store →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
