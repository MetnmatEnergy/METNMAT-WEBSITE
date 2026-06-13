"use client";

import * as React from "react";
import { formatINR } from "@/frontend/lib/catalog";

/**
 * Currency display context — fully automatic:
 *   · the visitor's COUNTRY (geo-IP via /api/geo) picks the currency
 *     (India → ₹ INR, everywhere else → $ USD),
 *   · the ₹/$ RATE is live (Open Exchange Rates → keyless FX fallback →
 *     staff-set rate in the dashboard), fetched server-side and passed in.
 *
 * Prices are STORED and CHARGED in INR; USD is a display conversion.
 * The geo result is cached in localStorage for a day so repeat visits don't
 * re-resolve. Checkout's "Shipping to" selector still syncs the currency
 * (changing destination is an explicit signal stronger than IP).
 */
export type Currency = "INR" | "USD";

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** ₹ per $1 (live rate, resolved server-side). */
  usdRate: number;
  /**
   * Format an INR amount in the visitor's currency. 0 → "On request".
   * For USD visitors, an optional `usdOverride` (a fixed USD figure set by staff)
   * is shown instead of the auto-converted value. INR visitors always see ₹.
   */
  money: (valueInr: number, usdOverride?: number) => string;
};

const CurrencyContext = React.createContext<Ctx | null>(null);
// Geo result — localStorage, 24h TTL. Key is versioned: bumping it invalidates
// any state poisoned by older behaviors (e.g. the override formerly persisting).
const GEO_KEY = "mm-geo-v2";
// ?currency= preview override — sessionStorage ONLY (dies with the tab), so a
// test/support link can never permanently flip a visitor's currency.
const OVERRIDE_KEY = "mm-currency-override";
const LEGACY_KEYS = ["mm-currency", "mm-currency-geo"];

export function CurrencyProvider({
  usdRate,
  children,
}: {
  usdRate: number;
  children: React.ReactNode;
}) {
  // SSR renders INR; the geo-resolved currency applies right after hydration.
  const [currency, setCurrencyState] = React.useState<Currency>("INR");

  React.useEffect(() => {
    let cancelled = false;
    // One-time cleanup of legacy storage (older builds persisted overrides here).
    try {
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    // 1) ?currency= preview override → THIS TAB ONLY (sessionStorage).
    try {
      const qs = new URLSearchParams(window.location.search).get("currency")?.toUpperCase();
      if (qs === "USD" || qs === "INR") {
        setCurrencyState(qs);
        sessionStorage.setItem(OVERRIDE_KEY, qs);
        return;
      }
      const tabOverride = sessionStorage.getItem(OVERRIDE_KEY);
      if (tabOverride === "USD" || tabOverride === "INR") {
        setCurrencyState(tabOverride);
        return;
      }
    } catch {
      /* fall through to geo */
    }
    // 2) Cached geo result (24h).
    try {
      const cached = JSON.parse(localStorage.getItem(GEO_KEY) || "null") as {
        currency?: Currency;
        at?: number;
      } | null;
      if (
        cached?.currency &&
        (cached.currency === "INR" || cached.currency === "USD") &&
        Date.now() - (cached.at ?? 0) < 24 * 60 * 60 * 1000
      ) {
        setCurrencyState(cached.currency);
        return;
      }
    } catch {
      /* re-resolve below */
    }
    // 3) Resolve from geo-IP.
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { currency?: Currency } | null) => {
        if (cancelled) return;
        const c: Currency = j?.currency === "USD" ? "USD" : "INR";
        setCurrencyState(c);
        try {
          localStorage.setItem(GEO_KEY, JSON.stringify({ currency: c, at: Date.now() }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* stay INR */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Programmatic set (no UI consumers today) — tab-scoped, never persistent.
  const setCurrency = React.useCallback((c: Currency) => {
    setCurrencyState(c);
    try {
      sessionStorage.setItem(OVERRIDE_KEY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const money = React.useCallback(
    (valueInr: number, usdOverride?: number): string => {
      if (!valueInr) return "On request";
      if (currency === "USD") {
        // Staff-set USD price wins; otherwise auto-convert from INR at the live rate.
        const usd =
          typeof usdOverride === "number" && usdOverride > 0 ? usdOverride : valueInr / usdRate;
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: usd >= 1000 ? 0 : 2,
        }).format(usd);
      }
      return formatINR(valueInr);
    },
    [currency, usdRate]
  );

  const value = React.useMemo(
    () => ({ currency, setCurrency, usdRate, money }),
    [currency, setCurrency, usdRate, money]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Ctx {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within <CurrencyProvider>");
  return ctx;
}
