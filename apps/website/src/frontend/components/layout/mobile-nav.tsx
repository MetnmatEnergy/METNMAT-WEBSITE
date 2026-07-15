"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/frontend/lib/site";
import { useQuote } from "@/frontend/components/commerce/quote-provider";
import { cn } from "@/frontend/lib/utils";
import { ThemeToggle } from "@/frontend/components/theme-toggle";

type NavItem = { label: string; href: string };

export function MobileNav({ items = mainNav }: { items?: NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  const { openModal } = useQuote();
  const pathname = usePathname();
  const toggleRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Close on route change.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Native-feel: lock body scroll + close on Escape while open. A11y: move focus
  // into the panel, trap Tab within it, and restore focus to the toggle on close
  // (keyboard / screen-reader users). Extends the same effect/handler so the
  // existing Escape + route-change close logic is untouched.
  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const restoreTo = toggleRef.current;

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
          ).filter((el) => el.tabIndex >= 0 && el.offsetParent !== null)
        : [];

    // Move focus into the panel (first link) on open.
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inPanel = panel.contains(document.activeElement);
      if (e.shiftKey) {
        if (!inPanel || document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inPanel || document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the toggle on close.
      restoreTo?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Animated hamburger ⇄ X (top-right corner of the header). */}
      <button
        ref={toggleRef}
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group relative z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted active:scale-95"
      >
        <svg
          className="pointer-events-none"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path
            d="M4 12L20 12"
            className="origin-center -translate-y-[7px] transition-all duration-300 [transition-timing-function:cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[315deg]"
          />
          <path
            d="M4 12H20"
            className="origin-center transition-all duration-300 [transition-timing-function:cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
          />
          <path
            d="M4 12H20"
            className="origin-center translate-y-[7px] transition-all duration-300 [transition-timing-function:cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-[135deg]"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop (click to close) */}
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-14 z-40 cursor-default bg-black/40 backdrop-blur-sm"
          />
          {/* Panel */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-border bg-background p-4 shadow-xl"
          >
            <nav className="flex flex-col gap-1">
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-surface text-brand" : "text-foreground/80 hover:bg-surface"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
                {[
                  { href: "/search", label: "Search" },
                  { href: "/cart", label: "Cart" },
                  { href: "/wishlist", label: "Wishlist" },
                  { href: "/account", label: "Account" },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="rounded-lg bg-surface px-3 py-2.5 text-center text-sm font-medium text-foreground/80 transition-colors hover:text-brand"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-surface px-3 py-2.5">
                <span className="text-sm font-medium text-foreground/80">Theme</span>
                <ThemeToggle />
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openModal();
                }}
                className="mt-3 w-full rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
              >
                Get a Quote
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
