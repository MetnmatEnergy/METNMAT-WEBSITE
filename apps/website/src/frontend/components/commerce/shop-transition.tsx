"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type ShopTransition = {
  /** True while a filter/sort navigation is in flight (server re-render). */
  isPending: boolean;
  /** Clone the current query, apply `mutate`, reset paging, and navigate. */
  navigate: (mutate: (params: URLSearchParams) => void) => void;
};

const Ctx = React.createContext<ShopTransition | null>(null);

/**
 * Shares a single navigation transition across the listing's filter sidebar,
 * mobile filter drawer and sort control, so one `isPending` flag can dim the
 * results while the server re-renders. Without it, changing a filter gives no
 * feedback until the new HTML streams in (search-param navigations don't trip
 * the route's loading.tsx). Wrap the listing's sidebar + results region in this.
 */
export function ShopTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page"); // any filter/sort change returns to page 1
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => router.push(url, { scroll: false }));
    },
    [router, pathname, searchParams]
  );

  return <Ctx.Provider value={{ isPending, navigate }}>{children}</Ctx.Provider>;
}

/** Required accessor — for components only ever rendered inside a listing. */
export function useShopTransition(): ShopTransition {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useShopTransition must be used within <ShopTransitionProvider>");
  return ctx;
}

/** Optional accessor — for shared controls (e.g. SortSelect on /search) that may
 *  render outside a listing and need to fall back to their own navigation. */
export function useOptionalShopTransition(): ShopTransition | null {
  return React.useContext(Ctx);
}
