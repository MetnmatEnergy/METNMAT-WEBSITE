"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/frontend/lib/utils";
import { useOptionalShopTransition } from "@/frontend/components/commerce/shop-transition";

const ARROW =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface";

/**
 * Real pagination — each control is a Link that sets ?page= (preserving
 * filters/sort), with a transition so the click is acknowledged.
 *
 * WHAT WAS WRONG
 * These were plain Links changing only the query string, and nothing anywhere
 * noticed. The global route-progress bar stands down on query-only navigations
 * by design, on the stated assumption that the shop's own transition covers
 * them — and it does not, because that flag is only flipped by the filter
 * sidebar calling navigate(). So clicking "2" produced no dim, no spinner, no
 * cursor change and no highlight move for the whole 0.3-0.6s server render.
 *
 * On the shop listing it was worse than merely silent. Pagination renders INSIDE
 * ResultsRegion, so it visibly dims when someone changes a filter — the control
 * demonstrates the acknowledgement for another action and then withholds it for
 * its own.
 *
 * The hrefs stay real. Crawlers need them, and so does anyone who middle-clicks
 * a page number or opens it in a new tab; the interception below bows out for
 * every modified click and lets the browser do its job.
 */
export function Pagination({ current = 1, total = 1 }: { current?: number; total?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  /**
   * On the shop listing this exists, and routing through it means ONE pending
   * flag dims the results and the pagination together. Elsewhere — /blog,
   * /search — there is no provider and we run our own.
   */
  const shop = useOptionalShopTransition();
  const [localPending, startLocal] = React.useTransition();

  const href = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const go = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
      // Leave every modified click to the browser: new tab, new window, download.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      e.preventDefault();
      // scroll: true — arriving at page 2 still looking at the pagination bar,
      // with a silently swapped grid above, is disorienting.
      if (shop) shop.push(url, { scroll: true });
      else startLocal(() => router.push(url, { scroll: true }));
    },
    [shop, router]
  );

  if (total <= 1) return null;

  // Only dim ourselves when nothing else is doing it. Inside the shop listing
  // ResultsRegion already dims this whole subtree, and doubling up reads as a
  // rendering bug rather than as feedback.
  const selfDim = !shop && localPending;

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
    const url = href(dir === "prev" ? current - 1 : current + 1);
    return (
      <Link href={url} aria-label={label} className={ARROW} onClick={(e) => go(e, url)}>
        <Icon className="h-4 w-4" />
      </Link>
    );
  };

  return (
    <nav
      aria-label="Pagination"
      aria-busy={selfDim || undefined}
      className={cn(
        "flex flex-wrap items-center justify-center gap-1 transition-opacity duration-200",
        selfDim && "pointer-events-none opacity-60"
      )}
    >
      {arrow("prev", current <= 1)}
      {pages.map((p) => {
        const url = href(p);
        return (
          <Link
            key={p}
            href={url}
            onClick={(e) => go(e, url)}
            aria-current={p === current ? "page" : undefined}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm transition-colors",
              p === current
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border hover:bg-surface"
            )}
          >
            {p}
          </Link>
        );
      })}
      {arrow("next", current >= total)}
    </nav>
  );
}
