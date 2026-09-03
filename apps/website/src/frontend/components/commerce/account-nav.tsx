"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, FileText, MapPin, User, Heart, LogOut, Loader2 } from "lucide-react";
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

  /*
   * Signing out awaits a round trip and used to show nothing while it ran: the
   * button looked dead, and a second click fired a second request. It stays
   * disabled through the navigation that follows too — there is no "signed out"
   * state to return to, so re-enabling it would only invite a pointless retry.
   */
  const [signingOut, setSigningOut] = React.useState(false);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      /* the cookie is cleared server-side or it is not; either way, leave */
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
        disabled={signingOut}
        aria-busy={signingOut}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border-border px-3 py-2.5 text-sm text-muted-foreground hover:text-brand disabled:opacity-60 lg:mt-2 lg:w-full lg:gap-3 lg:border-t lg:pt-4"
      >
        {signingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </nav>
  );
}
