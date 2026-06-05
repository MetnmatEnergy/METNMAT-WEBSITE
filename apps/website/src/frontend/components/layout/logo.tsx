import Link from "next/link";
import { site } from "@/frontend/lib/site";

/**
 * Brand lockup: an "M" mark + wordmark.
 * TODO(brand): replace the mark <svg> with the official logo asset.
 */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label={`${site.name} home`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-lg font-bold text-brand-foreground font-display">
        M
      </span>
      <span className="leading-none">
        <span className="block font-display text-base font-bold tracking-tight">
          {site.name}
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Research &amp; Innovations
        </span>
      </span>
    </Link>
  );
}
