"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { sortOptions } from "@/frontend/lib/catalog";
import { useOptionalShopTransition } from "@/frontend/components/commerce/shop-transition";
import { Select } from "@/frontend/components/ui/select";

/** Sort dropdown — writes ?sort= to the URL (and resets paging). On a shop
 *  listing it shares the page's filter transition (so re-sorting dims the
 *  results); elsewhere (e.g. /search) it falls back to its own navigation. */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") || "relevance";
  const shop = useOptionalShopTransition();
  // useTransition surfaces the server re-render so re-sorting doesn't look frozen.
  const [localPending, startTransition] = React.useTransition();
  const isPending = shop ? shop.isPending : localPending;

  function onChange(value: string) {
    const mutate = (params: URLSearchParams) => {
      if (value && value !== "relevance") params.set("sort", value);
      else params.delete("sort");
    };
    if (shop) {
      shop.navigate(mutate);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page"); // re-sorting returns to page 1
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort by</span>
      <Select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={isPending}
        aria-busy={isPending}
        className="h-9 min-w-[11rem] rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:border-brand"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
