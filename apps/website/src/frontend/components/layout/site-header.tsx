import Link from "next/link";
import { Search, User } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { Logo } from "@/frontend/components/layout/logo";
import { NavLinks } from "@/frontend/components/layout/nav-links";
import { MobileNav } from "@/frontend/components/layout/mobile-nav";
import { ThemeToggle } from "@/frontend/components/theme-toggle";
import { CartButton, WishlistBadgeButton } from "@/frontend/components/commerce/cart-button";
import { DepartmentsMenu } from "@/frontend/components/commerce/departments-menu";

const iconLink =
  "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-muted";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Row 1: brand + actions */}
      <Container className="flex h-[68px] items-center justify-between gap-4">
        <Logo />

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 sm:flex">
            <Link href="/search" aria-label="Search products" className={iconLink}>
              <Search className="h-[18px] w-[18px]" />
            </Link>
            <Link href="/account" aria-label="Your account" className={iconLink}>
              <User className="h-[18px] w-[18px]" />
            </Link>
            <WishlistBadgeButton />
            <ThemeToggle />
            <CartButton />
          </span>

          <Button href="/quote" className="hidden sm:inline-flex">
            Get a Quote
          </Button>

          <MobileNav />
        </div>
      </Container>

      {/* Row 2: departments + primary nav (desktop) */}
      <div className="hidden border-t border-border lg:block">
        <Container className="flex h-11 items-center gap-2">
          <DepartmentsMenu />
          <span className="mx-1 h-5 w-px bg-border" />
          <NavLinks />
        </Container>
      </div>
    </header>
  );
}
