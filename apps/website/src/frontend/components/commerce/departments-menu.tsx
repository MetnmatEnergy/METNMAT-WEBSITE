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
  const panelRef = React.useRef<HTMLDivElement>(null);
  // Only pull focus into the panel when it was opened from the keyboard —
  // stealing focus on a mouse click would scroll the page under the pointer.
  const focusFirstRef = React.useRef(false);

  const links = React.useCallback(
    () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? []),
    []
  );

  React.useEffect(() => {
    if (!open || !focusFirstRef.current) return;
    focusFirstRef.current = false;
    links()[0]?.focus();
  }, [open, links]);

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
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus(); // keyboard users land back on the trigger
        return;
      }

      const items = links();
      if (!items.length) return;
      const here = items.indexOf(document.activeElement as HTMLElement);

      // Arrow keys walk the departments; Home/End jump to the ends. Without
      // this the panel is reachable but not operable — Tab alone makes a
      // 40-link grid a long crawl.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = here < 0 ? 0 : (here + step + items.length) % items.length;
        items[next]?.focus();
        return;
      }
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        (e.key === "Home" ? items[0] : items[items.length - 1])?.focus();
        return;
      }

      // Trap Tab inside the panel so focus can't wander behind an open overlay.
      if (e.key === "Tab") {
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, links]);

  const topCategories = categories.filter((c) => !c.parent);
  const subCategories = (parent: string) => categories.filter((c) => c.parent === parent);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          // ArrowDown from the trigger is the standard way into a menu.
          if (e.key === "ArrowDown") {
            e.preventDefault();
            focusFirstRef.current = true;
            setOpen(true);
          }
        }}
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
            ref={panelRef}
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
              className="mt-4 block border-t border-border pt-3 text-sm font-medium text-brand-soft"
            >
              Visit the full store →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
