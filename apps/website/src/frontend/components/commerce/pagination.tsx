"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/frontend/lib/utils";

const ARROW =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-surface";

/** Real pagination — each control is a Link that sets ?page= (preserving filters/sort). */
export function Pagination({ current = 1, total = 1 }: { current?: number; total?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (total <= 1) return null;

  const href = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  // A window of up to 5 page numbers centred on the current page.
  const to = Math.min(total, Math.max(1, current - 2) + 4);
  const from = Math.max(1, to - 4);
  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);

  // Disabled boundary arrows are non-links (not keyboard-focusable, not navigable).
  const arrow = (dir: "prev" | "next", disabled: boolean) => {
    const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
    const label = dir === "prev" ? "Previous page" : "Next page";
    if (disabled) {
      return (
        <span aria-label={label} aria-disabled className={cn(ARROW, "pointer-events-none opacity-40")}>
          <Icon className="h-4 w-4" />
        </span>
      );
    }
    return (
      <Link href={href(dir === "prev" ? current - 1 : current + 1)} aria-label={label} className={ARROW}>
        <Icon className="h-4 w-4" />
      </Link>
    );
  };

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-center gap-1">
      {arrow("prev", current <= 1)}
      {pages.map((p) => (
        <Link
          key={p}
          href={href(p)}
          aria-current={p === current ? "page" : undefined}
          className={cn(
            "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm",
            p === current
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border hover:bg-surface"
          )}
        >
          {p}
        </Link>
      ))}
      {arrow("next", current >= total)}
    </nav>
  );
}
