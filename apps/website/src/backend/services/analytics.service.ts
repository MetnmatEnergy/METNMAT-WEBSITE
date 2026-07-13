/**
 * Analytics forwarder — the website server's one hop to the CMS ingest
 * endpoint. Follows the orders.service pattern: fetch + x-internal-key with a
 * purpose-scoped env (CMS_ANALYTICS_KEY) falling back to the shared key, so
 * there is zero deploy-ordering risk. Fire-and-forget semantics: analytics
 * must never make the public site slower or flakier than it already is.
 *
 * Geo enrichment is OPTIONAL and transient: when ANALYTICS_GEO_TOKEN (ipinfo)
 * is set, the visitor IP is used for ONE coarse COUNTRY-level lookup (ipinfo
 * "lite" tier) and immediately discarded — the IP itself is never stored nor
 * forwarded. Without the token, geography simply stays empty (honest empty-state
 * in the dashboard) — we never guess.
 */
import { outboundKey } from "@/backend/lib/internal-key";
import type { Attribution, DeviceInfo } from "@/frontend/lib/analytics/attribution";
import type { CollectedEvent } from "@/frontend/lib/analytics/session";

const CMS = process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001";

export type Geo = { country?: string; region?: string; city?: string };

export type IngestBatch = {
  vid: string;
  sid: string;
  events: CollectedEvent[];
  newSession?: {
    landing: string;
    attribution: Attribution;
    device: DeviceInfo;
    geo?: Geo;
  };
};

/** Per-instance transient geo cache (module-scope singleton, like commerceCache). */
const geoCache = new Map<string, { at: number; geo: Geo | null }>();
const GEO_TTL_MS = 60 * 60 * 1000;
const GEO_CACHE_MAX = 500;

export async function lookupGeo(ip: string | undefined): Promise<Geo | undefined> {
  const token = process.env.ANALYTICS_GEO_TOKEN;
  if (!token || !ip || ip === "unknown") return undefined;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_TTL_MS) return cached.geo ?? undefined;
  try {
    // ipinfo "lite" endpoint: country-level, Bearer auth (token never in the URL).
    // Returns { country_code: "IN", country: "India", continent, asn, … } — no
    // region/city on this tier. We store the readable full country name.
    const res = await fetch(`https://api.ipinfo.io/lite/${encodeURIComponent(ip)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const d = (await res.json()) as { country?: string; country_code?: string };
    const geo: Geo = {
      ...(d.country ? { country: d.country } : d.country_code ? { country: d.country_code } : {}),
    };
    if (geoCache.size >= GEO_CACHE_MAX) geoCache.clear();
    geoCache.set(ip, { at: Date.now(), geo });
    return geo;
  } catch {
    return undefined; // geo is enrichment, never a blocker
  }
}

/** Forward a validated batch to the CMS. Best-effort; the caller already 204'd. */
export async function forwardToCms(batch: IngestBatch): Promise<void> {
  try {
    const res = await fetch(`${CMS}/api/analytics-events/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": outboundKey("CMS_ANALYTICS_KEY"),
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[analytics] CMS ingest refused (${res.status})`);
    }
  } catch (e) {
    console.error("[analytics] CMS ingest error:", (e as Error).message);
  }
}
