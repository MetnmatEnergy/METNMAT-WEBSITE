"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  LayoutDashboard,
  Package,
  FileText,
  MapPin,
  UserRound,
  Heart,
  LogIn,
  UserPlus,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/frontend/lib/utils";
import { Avatar } from "@/frontend/components/commerce/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/frontend/components/ui/dropdown-menu";

type Me = { name?: string; email?: string; userCode?: string; avatar?: string };

const LINKS = [
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/rfq", label: "My RFQs / Quotes", icon: FileText },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
];

/**
 * Header account menu. The state is fetched CLIENT-SIDE (via /api/account/me) on
 * mount so the shared server-rendered header never reads cookies — keeping the
 * marketing/shop pages statically prerenderable. Shows the signed-in identity +
 * quick links, or sign-in/create-account when signed out.
 */
export function AccountMenu({ triggerClassName }: { triggerClassName?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [me, setMe] = React.useState<Me | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/account/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { customer: null }))
      .then((d: { customer?: Me | null }) => {
        if (!cancelled) {
          setMe(d?.customer ?? null);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect an avatar change made on the profile page instantly (same tab), so
  // the header picture updates without a reload.
  React.useEffect(() => {
    function onAvatar(e: Event) {
      const v = (e as CustomEvent<string>).detail;
      setMe((m) => (m ? { ...m, avatar: v } : m));
    }
    window.addEventListener("mm:avatar-updated", onAvatar);
    return () => window.removeEventListener("mm:avatar-updated", onAvatar);
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      /* ignore — clear locally regardless */
    }
    setMe(null);
    setSigningOut(false);
    setOpen(false); // close the menu once sign-out completes (preventDefault kept it open)
    router.push("/");
    router.refresh();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Your account"
          className={cn(
            me
              ? "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-1 ring-border transition-transform hover:ring-foreground/25 active:scale-95"
              : triggerClassName,
          )}
        >
          {me ? (
            <Avatar value={me.avatar} name={me.name} email={me.email} sizeClass="h-full w-full" textClass="text-sm" />
          ) : (
            <User className="h-[18px] w-[18px]" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64">
        {!loaded ? (
          <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : me ? (
          <>
            <DropdownMenuLabel className="flex items-center gap-3 py-2 normal-case">
              <Avatar value={me.avatar} name={me.name} email={me.email} sizeClass="h-10 w-10" textClass="text-base" />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Signed in as</span>
                <span className="truncate text-sm font-semibold text-foreground">{me.name || me.email}</span>
                {me.userCode ? (
                  <span className="w-fit rounded-full border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground/80">
                    {me.userCode}
                  </span>
                ) : null}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {LINKS.map((l) => (
                <DropdownMenuItem key={l.href} asChild>
                  <Link href={l.href} className="cursor-pointer">
                    <l.icon className="h-4 w-4 text-muted-foreground" />
                    {l.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void signOut();
              }}
              className="cursor-pointer text-brand focus:bg-brand/10 focus:text-brand"
            >
              {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Sign out
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-2 normal-case">
              <span className="text-sm font-semibold text-foreground">Welcome to METNMAT</span>
              <span className="text-xs font-normal text-muted-foreground">Sign in to track orders, quotes &amp; more.</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login" className="cursor-pointer">
                <LogIn className="h-4 w-4 text-muted-foreground" />
                Sign in
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/login" className="cursor-pointer">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                Create account
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
