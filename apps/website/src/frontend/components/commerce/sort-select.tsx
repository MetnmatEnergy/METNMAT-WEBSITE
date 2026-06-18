"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { sortOptions } from "@/frontend/lib/catalog";

/** Sort dropdown — writes ?sort= to the URL (and resets paging). */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") || "relevance";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "relevance") params.set("sort", value);
    else params.delete("sort");
    params.delete("page"); // re-sorting returns to page 1
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Sort by</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-input bg-surface px-3 text-sm outline-none focus:border-brand"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
