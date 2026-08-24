"use client";

import * as React from "react";
import { formatINR } from "@/frontend/lib/catalog";
import {
  REGION_COOKIE,
  REGION_MAX_AGE,
  currencyForRegion,
  formatUSD,
  isRegion,
  type Currency,
  type Region,
} from "@/frontend/lib/region";

/**
 * Shopping region and the currency that follows from it.
 *
 * Region is resolved SERVER-side (geo-IP via /api/geo, or a country resolved
 * from coordinates the visitor explicitly offered) and then persisted in a
 * cookie. Prices are STORED and CHARGED in INR; USD is a display conversion,
 * and `create-order` recomputes every line from the CMS regardless of what the
 * browser sends.
 *
 * WHY A COOKIE, AND WHY IT IS READ ON THE CLIENT
 * /shop and /cart are statically rendered and /shop/p/[slug] prerenders every
 * product page. Reading the cookie in the server layout would opt all of that
 * into dynamic rendering — trading a fast catalogue for a first paint that is
 * already in the right currency. So the server keeps emitting the canonical INR
 * markup (which is also what crawlers should index) and the region is applied
 * on the client in a layout effect: after hydration, before paint. No mismatch,
 * no visible flash, and no network round trip on any visit after the first.
 *
 * The cookie is not httpOnly on purpose — this component has to read it — and
 * it is a display preference, not a credential. Nothing security-bearing is
 * decided from it.
 */
export type { Currency } from "@/frontend/lib/region";

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  region: Region;
  /** Persists the choice and re-renders every price. */
  setRegion: (r: Region) => void;
  /** False until the region has been established, so the bar can stay quiet. */
  regionResolved: boolean;
  /** ₹ per $1 (live rate, resolved server-side). */
  usdRate: number;
  /**
   * Format an INR amount in the visitor's currency. 0 → "On request".
   * `usdOverride` is a fixed USD figure set by staff; when present it is shown
   * instead of the converted value. INR visitors always see ₹.
   */
  money: (valueInr: number, usdOverride?: number) => string;
};

const CurrencyContext = React.createContext<Ctx | null>(null);

// ?currency= preview override — sessionStorage ONLY (dies with the tab), so a
// test or support link can never permanently flip a visitor's currency.
const OVERRIDE_KEY = "mm-currency-override";
// Superseded by the region cookie. Read once to carry existing visitors across,
// then removed.
const LEGACY_GEO_KEY = "mm-geo-v2";
const LEGACY_KEYS = ["mm-currency", "mm-currency-geo"];

/** Layout effect on the client, plain effect on the server (which never runs it). */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function readRegionCookie(): Region | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${REGION_COOKIE}=([^;]*)`));
  const v = m?.[1];
  return isRegion(v) ? v : null;
}

export function writeRegionCookie(region: Region): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REGION_COOKIE}=${region}; Path=/; Max-Age=${REGION_MAX_AGE}; SameSite=Lax${secure}`;
}

export function CurrencyProvider({
  usdRate,
  initialRegion,
  children,
}: {
  usdRate: number;
  /** Supplied by routes that already render dynamically; omitted elsewhere. */
  initialRegion?: Region;
  children: React.ReactNode;
}) {
  // Server and first client render must agree, so both start from the home
  // market. The layout effect below corrects it before anything is painted.
  const [region, setRegionState] = React.useState<Region>(initialRegion ?? "IN");
  const [regionResolved, setResolved] = React.useState(Boolean(initialRegion));
  // A tab-scoped ?currency= override outranks the region for display only.
  const [override, setOverride] = React.useState<Currency | null>(null);

  useIsomorphicLayoutEffect(() => {
    try {
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }

    // 1) ?currency= preview override → THIS TAB ONLY.
    try {
      const qs = new URLSearchParams(window.location.search).get("currency")?.toUpperCase();
      if (qs === "USD" || qs === "INR") {
        sessionStorage.setItem(OVERRIDE_KEY, qs);
        setOverride(qs);
        setResolved(true);
        return;
      }
      const tabOverride = sessionStorage.getItem(OVERRIDE_KEY);
      if (tabOverride === "USD" || tabOverride === "INR") {
        setOverride(tabOverride);
        setResolved(true);
        return;
      }
    } catch {
      /* fall through */
    }

    // 2) The cookie — synchronous, so a repeat visitor never sees the wrong
    //    currency and never waits on the network.
    const fromCookie = readRegionCookie();
    if (fromCookie) {
      setRegionState(fromCookie);
      setResolved(true);
      return;
    }

    // 3) Carry existing visitors over from the old localStorage cache rather
    //    than re-resolving everyone the day this ships.
    try {
      const cached = JSON.parse(localStorage.getItem(LEGACY_GEO_KEY) || "null") as {
        currency?: Currency;
        at?: number;
      } | null;
      if (
        (cached?.currency === "INR" || cached?.currency === "USD") &&
        Date.now() - (cached.at ?? 0) < 24 * 60 * 60 * 1000
      ) {
        const migrated: Region = cached.currency === "USD" ? "INTL" : "IN";
        writeRegionCookie(migrated);
        localStorage.removeItem(LEGACY_GEO_KEY);
        setRegionState(migrated);
        setResolved(true);
        return;
      }
    } catch {
      /* fall through to geo */
    }

    // 4) First visit: resolve server-side from the request IP.
    let cancelled = false;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { currency?: Currency; country?: string } | null) => {
        if (cancelled) return;
        const resolved: Region = j?.currency === "USD" ? "INTL" : "IN";
        writeRegionCookie(resolved);
        setRegionState(resolved);
        setResolved(true);
      })
      .catch(() => {
        // Stay on the home market; the site renders correctly either way.
        if (!cancelled) setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setRegion = React.useCallback((r: Region) => {
    writeRegionCookie(r);
    setRegionState(r);
    setResolved(true);
    // An explicit region choice outranks a stale tab override.
    try {
      sessionStorage.removeItem(OVERRIDE_KEY);
    } catch {
      /* ignore */
    }
    setOverride(null);
  }, []);

  const currency: Currency = override ?? currencyForRegion(region);

  // Kept for existing callers. Setting a currency is really choosing a region,
  // so it routes through the same persistence rather than a parallel one.
  const setCurrency = React.useCallback(
    (c: Currency) => setRegion(c === "USD" ? "INTL" : "IN"),
    [setRegion]
  );

  const money = React.useCallback(
    (valueInr: number, usdOverride?: number): string => {
      if (!valueInr) return "On request";
      if (currency === "USD") {
        // A staff-set USD price wins; otherwise convert at the live rate.
        const usd =
          typeof usdOverride === "number" && usdOverride > 0 ? usdOverride : valueInr / usdRate;
        return formatUSD(usd);
      }
      return formatINR(valueInr);
    },
    [currency, usdRate]
  );

  const value = React.useMemo(
    () => ({ currency, setCurrency, region, setRegion, regionResolved, usdRate, money }),
    [currency, setCurrency, region, setRegion, regionResolved, usdRate, money]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): Ctx {
  const ctx = React.useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
