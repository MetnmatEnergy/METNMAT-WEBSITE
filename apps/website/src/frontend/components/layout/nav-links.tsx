"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/frontend/lib/site";
import { cn } from "@/frontend/lib/utils";

type NavItem = { label: string; href: string };

export function NavLinks({ className, items = mainNav }: { className?: string; items?: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-brand"
                : "text-foreground/80 hover:text-foreground"
            )}
          >
            {item.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
