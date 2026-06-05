"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { mainNav } from "@/frontend/lib/site";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 border-b border-border bg-background p-4 shadow-xl">
          <nav className="flex flex-col gap-1">
            {mainNav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm font-medium",
                    active ? "bg-surface text-brand" : "text-foreground/80"
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
                  className="rounded-lg bg-surface px-3 py-2.5 text-center text-sm font-medium text-foreground/80"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <Button href="/quote" className="mt-3 w-full">
              Get a Quote
            </Button>
          </nav>
        </div>
      )}
    </div>
  );
}
