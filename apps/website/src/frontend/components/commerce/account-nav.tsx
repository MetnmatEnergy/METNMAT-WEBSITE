"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, FileText, MapPin, User, Heart, LogOut } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

const links = [
  { href: "/account/profile", label: "Profile", icon: User },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/rfq", label: "My RFQs / Quotes", icon: FileText },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/");
    router.refresh();
  }

  return (
    // Horizontal, scrollable chip row on mobile (so it doesn't push the page
    // content down); a vertical sidebar on lg+.
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {links.map((l) => {
        const active = l.href === "/account" ? pathname === "/account" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm lg:gap-3",
              active ? "bg-surface font-medium text-brand" : "text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={logout}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-brand lg:mt-2 lg:w-full lg:gap-3 lg:border-t lg:pt-4"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </nav>
  );
}
