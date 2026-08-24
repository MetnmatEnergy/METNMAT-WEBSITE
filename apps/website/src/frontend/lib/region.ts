/**
 * Shopping region — the one decision the rest of the storefront hangs off.
 *
 * Currency used to double as the region, which worked while currency was the
 * only thing that varied. It is not: address format, payment method and
 * shipping all follow the same fork, and inferring each of them from "is the
 * currency USD" spreads the same conditional across unrelated components.
 *
 *     region → currency → pricing → payment → address
 *
 * Region is resolved on the SERVER and travels in a cookie. The browser may
 * *ask* for a different region, but it never decides one on its own, and it is
 * never the source of a payable amount — `create-order` recomputes every line
 * from the CMS regardless of what arrives with the request.
 */
import { formatINR, inclGST, isQuoteOnly, pricingMode, unitPriceForQty, usdFor, type Product } from "./catalog";

export type Region = "IN" | "INTL";
export type Currency = "INR" | "USD";

/** Cookie name. Readable by the client, which needs it to render the region bar. */
export const REGION_COOKIE = "mm-region";
/** A year. Region is a preference, not a session fact. */
export const REGION_MAX_AGE = 60 * 60 * 24 * 365;

export const isRegion = (v: unknown): v is Region => v === "IN" || v === "INTL";

/** India ships in rupees; everywhere else is quoted in dollars. */
export const currencyForRegion = (region: Region): Currency => (region === "IN" ? "INR" : "USD");

/**
 * ISO-3166 alpha-2 → region.
 *
 * An unreadable or absent code resolves to the HOME market, matching what
 * /api/geo already does on a lookup failure. Defaulting the other way would
 * quote dollars to a visitor we failed to identify — and most of them are in
 * the home market.
 */
export const regionForCountry = (code: string | null | undefined): Region => {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) return "IN";
  return c === "IN" ? "IN" : "INTL";
};

/** Parse the region cookie out of a raw Cookie header, for server components. */
export function regionFromCookieHeader(header: string | null | undefined): Region | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === REGION_COOKIE) return isRegion(rest.join("=")) ? (rest.join("=") as Region) : null;
  }
  return null;
}

export const REGION_LABEL: Record<Region, string> = {
  IN: "India",
  INTL: "International",
};

/** Flag-ish glyph for the region indicator. Not a country flag for INTL — it isn't one country. */
export const REGION_GLYPH: Record<Region, string> = {
  IN: "🇮🇳",
  INTL: "🌎",
};

/**
 * Format a USD amount.
 *
 * Cents appear only when the figure actually has them: a fixed $700 price
 * should read "$700", not "$700.00". Above $1000 cents are dropped entirely —
 * they are false precision on a converted number that is not accurate to the
 * cent in the first place.
 */
export function formatUSD(value: number): string {
  const whole = Number.isInteger(value) || value >= 1000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value);
}

/**
 * Compact form for product cards, where the full figure crowds the tile.
 * ₹50,000 → "₹50K", $590 → "$590".
 */
export function formatCompact(value: number, currency: Currency): string {
  if (currency === "USD") {
    return value >= 10_000
      ? `$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`
      : formatUSD(value);
  }
  if (value >= 1000) {
    return `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
  }
  return formatINR(value);
}

/**
 * The normalized shape every surface consumes — card, product page, cart,
 * checkout. Components render `formattedAmount`; they do not do arithmetic.
 *
 * `baseAmount` is always the GST-inclusive INR figure, because that is what is
 * actually charged. `exchangeRate` is present only when the displayed amount
 * was derived from it, so a fixed international price never carries a rate it
 * did not use.
 */
export type ResolvedPrice = {
  region: Region;
  currency: Currency;
  amount: number;
  formattedAmount: string;
  compactAmount: string;
  pricingMode: "AUTO_CONVERT" | "FIXED_USD";
  /** GST-inclusive INR — the charged amount, whatever the display currency. */
  baseAmount: number;
  exchangeRate?: number;
};

/**
 * The single entry point for "what does this customer see for this product?".
 *
 * Everything price-shaped goes through here — card, product page, cart line,
 * checkout summary — so the four surfaces cannot drift apart. The maths itself
 * is not reimplemented: tier selection, GST and the proportional fixed-USD
 * scaling stay in catalog.ts where they already work and are already relied on
 * by the order route.
 *
 * `qty` matters because bulk tiers change the unit price, and because a fixed
 * international price scales proportionally rather than multiplying a rounded
 * per-unit figure.
 */
export function resolveProductPricing(
  product: Product,
  region: Region,
  usdRate: number,
  qty = 1
): ResolvedPrice | null {
  // Quote-only products have no price to show; the caller renders an enquiry
  // CTA instead. Null rather than a zero, so a falsy amount cannot render as
  // free by accident.
  if (isQuoteOnly(product)) return null;

  const unitInr = unitPriceForQty(product, qty);
  const baseAmount = inclGST(unitInr) * qty;
  const mode = pricingMode(product);
  const currency = currencyForRegion(region);

  if (currency === "INR") {
    return {
      region,
      currency,
      amount: baseAmount,
      formattedAmount: formatINR(baseAmount),
      compactAmount: formatCompact(baseAmount, "INR"),
      pricingMode: mode,
      baseAmount,
    };
  }

  // A fixed international price is used exactly as configured and never touched
  // by the exchange rate, so no rate is reported for it.
  const fixed = usdFor(product, baseAmount);
  const amount = fixed ?? Math.round((baseAmount / usdRate) * 100) / 100;

  return {
    region,
    currency,
    amount,
    formattedAmount: formatUSD(amount),
    compactAmount: formatCompact(amount, "USD"),
    pricingMode: mode,
    baseAmount,
    ...(fixed === undefined ? { exchangeRate: usdRate } : {}),
  };
}
