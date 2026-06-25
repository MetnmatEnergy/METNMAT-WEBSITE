"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { sortOptions } from "@/frontend/lib/catalog";

/** Sort dropdown — writes ?sort= to the URL (and resets paging). */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") || "relevance";
  // useTransition surfaces the server re-render so re-sorting doesn't look frozen.
  const [isPending, startTransition] = React.useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "relevance") params.set("sort", value);
    else params.delete("sort");
    params.delete("page"); // re-sorting returns to page 1
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort by</span>
      <span className="relative inline-flex items-center">
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          disabled={isPending}
          aria-busy={isPending}
          className="h-9 rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:border-brand disabled:opacity-60"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {isPending && (
          <Loader2 className="pointer-events-none absolute right-2 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        )}
      </span>
    </label>
  );
}
