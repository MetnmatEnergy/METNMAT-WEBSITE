import type { Payload } from "payload";

/**
 * ₹-per-$1 exchange rate for the admin (mirrors the website's getUsdRate chain):
 *   1. Open Exchange Rates (if OPEN_EXCHANGE_RATES_APP_ID is set in the dashboard env)
 *   2. open.er-api.com — keyless live fallback
 *   3. The staff-maintained rate in the Commerce & Pricing global
 *   4. 84 — hardcoded final fallback
 *
 * Never throws. Cached per-process for 1h so a burst of saves (or the boot
 * seed) makes at most one network call.
 */

const sane = (r: unknown): number | null => {
  const n = Number(r);
  return Number.isFinite(n) && n > 20 && n < 500 ? n : null; // sanity band for INR/USD
};

let cached: { rate: number; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

async function fetchLive(): Promise<number | null> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (appId) {
    try {
      const res = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=INR`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const j = (await res.json()) as { rates?: { INR?: number } };
        const r = sane(j?.rates?.INR);
        if (r) return r;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const j = (await res.json()) as { rates?: { INR?: number } };
      const r = sane(j?.rates?.INR);
      if (r) return r;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/** ₹ per $1. Live → CMS Commerce rate → 84. Cached 1h. Never throws. */
export async function getInrPerUsd(payload?: Payload): Promise<number> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rate;

  let rate = await fetchLive();

  if (!rate && payload) {
    try {
      const commerce = await payload.findGlobal({ slug: "commerce" as never });
      rate = sane((commerce as { usdExchangeRate?: number })?.usdExchangeRate);
    } catch {
      /* fall through */
    }
  }

  if (!rate) rate = 84;
  cached = { rate, at: Date.now() };
  return rate;
}

export const DASH_GST_RATE = 0.18;
