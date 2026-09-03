"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/frontend/lib/site";
import { useQuote } from "@/frontend/components/commerce/quote-provider";
import { cn } from "@/frontend/lib/utils";
import { ThemeToggle } from "@/frontend/components/theme-toggle";

type NavItem = { label: string; href: string };

export function MobileNav({ items = mainNav }: { items?: NavItem[] }) {
  const [open, setOpen] = React.useState(false);
  // Portals need a document; render nothing on the server pass.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  /**
   * Close on tap, not on arrival.
   *
   * The only close path used to be the route-change effect below, which fires
   * when the new page COMMITS — so the menu sat open over the page for the whole
   * 0.3-0.6s navigation, and tapping the link for the page you were already on
   * never closed it at all, because the pathname never changed.
   */
  const closeAndGo = React.useCallback(() => setOpen(false), []);
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
          {/*
            Backdrop, PORTALED to <body>.
            The header carries `backdrop-blur`, and backdrop-filter creates a
            containing block for fixed descendants — so this element's
            `fixed inset-0 top-14` resolved against the 56px-tall header instead
            of the viewport and rendered ZERO pixels high. There was no scrim and
            tapping outside the menu did nothing. A portal puts it back in the
            viewport's coordinate space; z-30 keeps it under the header (z-40)
            and the panel (z-50) while covering the page behind them.
          */}
          {mounted &&
            createPortal(
              <button
                type="button"
                aria-label="Close menu"
                tabIndex={-1}
                onClick={closeAndGo}
                className="fixed inset-0 top-14 z-30 cursor-default bg-black/40 backdrop-blur-sm"
              />,
              document.body
            )}
          {/* Panel */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            // pb clears the chat bubble, which is fixed to the bottom-right by
            // a third-party embed we cannot restyle from here. Without it the
            // bubble sits on top of the last row (Account / Get a Quote) with
            // no way to scroll them clear. Padding-bottom is inside the scroll
            // area, so the panel is no taller than its content needs.
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-border bg-background p-4 pb-24 shadow-xl"
          >
            <nav className="flex flex-col gap-1">
              {items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeAndGo}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-surface text-brand-soft" : "text-foreground/80 hover:bg-surface"
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
                    onClick={closeAndGo}
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
